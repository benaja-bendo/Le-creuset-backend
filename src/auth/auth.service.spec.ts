import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import {
  createMockPrismaService,
  createMockJwtService,
  fakeUser,
} from "../common/test-utils";
import { randomBytes, scryptSync } from "crypto";

// Helper to create a real hash for test verification
function hashPassword(password: string, salt: string): string {
  const derived = scryptSync(password, salt, 32);
  return `${salt}:${derived.toString("hex")}`;
}

describe("AuthService", () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let jwt: ReturnType<typeof createMockJwtService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    jwt = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  /* ================================================================ */
  /*  register                                                         */
  /* ================================================================ */

  describe("register", () => {
    const dto = {
      email: "new@example.com",
      password: "password123",
      name: "New User",
      companyName: "New Co",
      phone: "0600000000",
      address: "1 rue du Test",
      kbisFileUrl: "/api/storage/file/kbis.pdf",
      customsFileUrl: "/api/storage/file/customs.pdf",
    };

    it("should create a user and return { id, status }", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(
        fakeUser({ id: "new-id", status: "PENDING", email: dto.email }),
      );

      const result = await service.register(dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result).toEqual({ id: "new-id", status: "PENDING" });

      // Verify the password was hashed (not stored in plain text)
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe(dto.password);
      expect(createCall.data.passwordHash).toContain(":");
    });

    it("should throw UnauthorizedException if email already exists", async () => {
      prisma.user.findUnique.mockResolvedValue(fakeUser());

      await expect(service.register(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  /* ================================================================ */
  /*  login                                                            */
  /* ================================================================ */

  describe("login", () => {
    const dto = { email: "test@example.com", password: "password123" };

    it("should return a token and user info on success", async () => {
      const salt = randomBytes(16).toString("hex");
      const user = fakeUser({
        passwordHash: hashPassword("password123", salt),
        status: "ACTIVE",
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.login(dto);

      expect(jwt.sign).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      });
      expect(result).toEqual({
        token: "mock-jwt-token",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          companyName: user.companyName,
        },
      });
    });

    it("should throw UnauthorizedException if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if password is wrong", async () => {
      const salt = randomBytes(16).toString("hex");
      const user = fakeUser({
        passwordHash: hashPassword("correct-password", salt),
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw ForbiddenException if account is rejected", async () => {
      const salt = randomBytes(16).toString("hex");
      const user = fakeUser({
        passwordHash: hashPassword("password123", salt),
        status: "REJECTED",
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });
  });
});
