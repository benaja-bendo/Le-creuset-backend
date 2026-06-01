import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";
import { WeightsService } from "../weights/weights.service";
import {
  createMockPrismaService,
  createMockWeightsService,
  fakeUser,
} from "../common/test-utils";
import { randomBytes, scryptSync } from "crypto";

function hashPassword(password: string, salt: string): string {
  const derived = scryptSync(password, salt, 32);
  return `${salt}:${derived.toString("hex")}`;
}

describe("UsersService", () => {
  let service: UsersService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let weightsService: ReturnType<typeof createMockWeightsService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    weightsService = createMockWeightsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: WeightsService, useValue: weightsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  /* ================================================================ */
  /*  register                                                         */
  /* ================================================================ */

  describe("register", () => {
    it("should create a user with disabled password", async () => {
      const dto = {
        email: "new@example.com",
        name: "New User",
        companyName: "Co",
        phone: "06",
        address: "addr",
        kbisFileUrl: "/api/file/k.pdf",
        customsFileUrl: "/api/file/c.pdf",
      };
      const created = fakeUser({ ...dto, status: "PENDING" });
      prisma.user.create.mockResolvedValue(created);

      const result = await service.register(dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: dto.email,
            role: "CLIENT",
            status: "PENDING",
          }),
        }),
      );
      // password hash should be a disabled one
      const call = prisma.user.create.mock.calls[0][0];
      expect(call.data.passwordHash).toMatch(/^disabled:/);
      expect(result).toEqual(created);
    });
  });

  /* ================================================================ */
  /*  findAll / findPending                                            */
  /* ================================================================ */

  describe("findAll", () => {
    it("should return all users ordered by createdAt desc", async () => {
      const users = [fakeUser(), fakeUser({ id: "user-2" })];
      prisma.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
      expect(result).toEqual(users);
    });
  });

  describe("findPending", () => {
    it("should return only PENDING users", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.findPending();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PENDING" },
        }),
      );
    });
  });

  /* ================================================================ */
  /*  updateStatus                                                     */
  /* ================================================================ */

  describe("updateStatus", () => {
    it("should update status to ACTIVE and initialize weight accounts", async () => {
      const user = fakeUser({ status: "ACTIVE" });
      prisma.user.update.mockResolvedValue(user);

      const result = await service.updateStatus("user-1", "ACTIVE" as any);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { status: "ACTIVE" },
      });
      expect(weightsService.initializeUserAccounts).toHaveBeenCalledWith(
        "user-1",
      );
      expect(result).toEqual(user);
    });

    it("should delete user when status is REJECTED", async () => {
      prisma.user.delete.mockResolvedValue(fakeUser({ status: "REJECTED" }));

      await service.updateStatus("user-1", "REJECTED" as any);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
      expect(weightsService.initializeUserAccounts).not.toHaveBeenCalled();
    });
  });

  /* ================================================================ */
  /*  getProfile                                                       */
  /* ================================================================ */

  describe("getProfile", () => {
    it("should return user profile without passwordHash", async () => {
      const user = fakeUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile("user-1");

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          select: expect.not.objectContaining({ passwordHash: true }),
        }),
      );
      expect(result).toEqual(user);
    });

    it("should throw UnauthorizedException if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile("nonexistent")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  /* ================================================================ */
  /*  updateProfile                                                    */
  /* ================================================================ */

  describe("updateProfile", () => {
    it("should update user profile fields", async () => {
      const dto = {
        name: "Updated",
        companyName: "New Co",
        phone: "07",
        address: "new addr",
      };
      prisma.user.update.mockResolvedValue(fakeUser(dto));

      const result = await service.updateProfile("user-1", dto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: dto,
        }),
      );
      expect(result.name).toBe("Updated");
    });
  });

  /* ================================================================ */
  /*  changePassword                                                   */
  /* ================================================================ */

  describe("changePassword", () => {
    const salt = randomBytes(16).toString("hex");

    it("should change password when current password is correct", async () => {
      const user = fakeUser({
        passwordHash: hashPassword("oldpass", salt),
      });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      const result = await service.changePassword("user-1", {
        currentPassword: "oldpass",
        newPassword: "newpass123",
        confirmPassword: "newpass123",
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            passwordHash: expect.stringContaining(":"),
          }),
        }),
      );
      expect(result).toEqual({
        success: true,
        message: "Mot de passe mis à jour avec succès",
      });
    });

    it("should throw UnauthorizedException for wrong current password", async () => {
      const user = fakeUser({
        passwordHash: hashPassword("correct", salt),
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.changePassword("user-1", {
          currentPassword: "wrong",
          newPassword: "newpass123",
          confirmPassword: "newpass123",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword("user-1", {
          currentPassword: "pass",
          newPassword: "newpass",
          confirmPassword: "newpass",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  /* ================================================================ */
  /*  updateDocuments                                                   */
  /* ================================================================ */

  describe("updateDocuments", () => {
    it("should update KBIS and customs URLs", async () => {
      const dto = {
        kbisFileUrl: "/api/storage/file/new-kbis.pdf",
        customsFileUrl: "/api/storage/file/new-customs.pdf",
      };
      prisma.user.update.mockResolvedValue(fakeUser(dto));

      await service.updateDocuments("user-1", dto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: dto,
        }),
      );
    });
  });

  /* ================================================================ */
  /*  updateRole                                                       */
  /* ================================================================ */

  describe("updateRole", () => {
    const salt = randomBytes(16).toString("hex");

    it("should update role when admin credentials are valid", async () => {
      const admin = fakeUser({
        id: "admin-1",
        role: "ADMIN",
        passwordHash: hashPassword("admin-pass", salt),
      });
      prisma.user.findUnique.mockResolvedValue(admin);
      prisma.user.update.mockResolvedValue(
        fakeUser({ id: "target-1", role: "ADMIN" }),
      );

      const result = await service.updateRole("target-1", "admin-1", {
        role: "ADMIN" as any,
        adminPassword: "admin-pass",
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "target-1" },
          data: { role: "ADMIN" },
        }),
      );
      expect(result.role).toBe("ADMIN");
    });

    it("should throw UnauthorizedException if caller is not admin", async () => {
      const nonAdmin = fakeUser({ id: "user-2", role: "CLIENT" });
      prisma.user.findUnique.mockResolvedValue(nonAdmin);

      await expect(
        service.updateRole("target-1", "user-2", {
          role: "ADMIN" as any,
          adminPassword: "pass",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if admin password is wrong", async () => {
      const admin = fakeUser({
        id: "admin-1",
        role: "ADMIN",
        passwordHash: hashPassword("correct", salt),
      });
      prisma.user.findUnique.mockResolvedValue(admin);

      await expect(
        service.updateRole("target-1", "admin-1", {
          role: "ADMIN" as any,
          adminPassword: "wrong",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
