import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { MailService } from "../mail/mail.service";
import { createMockMailService, fakeUser } from "../common/test-utils";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: Record<string, jest.Mock>;
  let mailService: ReturnType<typeof createMockMailService>;

  const mockReq = (overrides = {}) => ({
    user: {
      id: "user-1",
      email: "test@example.com",
      role: "CLIENT",
      status: "ACTIVE",
    },
    ...overrides,
  });

  beforeEach(async () => {
    usersService = {
      register: jest.fn().mockResolvedValue(fakeUser({ status: "PENDING" })),
      findAll: jest.fn().mockResolvedValue([fakeUser()]),
      findPending: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue(fakeUser({ status: "ACTIVE" })),
      findById: jest.fn().mockResolvedValue(fakeUser()),
      getProfile: jest.fn().mockResolvedValue(fakeUser()),
      updateProfile: jest.fn().mockResolvedValue(fakeUser()),
      changePassword: jest
        .fn()
        .mockResolvedValue({ success: true, message: "OK" }),
      updateDocuments: jest.fn().mockResolvedValue(fakeUser()),
      updateRole: jest.fn().mockResolvedValue(fakeUser({ role: "ADMIN" })),
    };
    mailService = createMockMailService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe("POST /register", () => {
    it("should register user and send email, return { id, status }", async () => {
      const dto = {
        email: "new@example.com",
        name: "New",
        companyName: "Co",
        phone: "06",
        address: "addr",
        kbisFileUrl: "/api/file/k.pdf",
        customsFileUrl: "/api/file/c.pdf",
      };

      const result = await controller.register(dto);

      expect(usersService.register).toHaveBeenCalledWith(dto);
      expect(mailService.sendEmail).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ status: "PENDING" }));
    });
  });

  describe("GET /me", () => {
    it("should return the authenticated user profile", async () => {
      const req = mockReq();
      await controller.getMyProfile(req as any);
      expect(usersService.getProfile).toHaveBeenCalledWith("user-1");
    });
  });

  describe("PATCH /me", () => {
    it("should update profile for authenticated user", async () => {
      const req = mockReq();
      const dto = { name: "Updated" };
      await controller.updateMyProfile(req as any, dto);
      expect(usersService.updateProfile).toHaveBeenCalledWith("user-1", dto);
    });
  });

  describe("PATCH /me/password", () => {
    it("should change password for authenticated user", async () => {
      const req = mockReq();
      const dto = {
        currentPassword: "old",
        newPassword: "new123",
        confirmPassword: "new123",
      };
      await controller.changeMyPassword(req as any, dto);
      expect(usersService.changePassword).toHaveBeenCalledWith("user-1", dto);
    });
  });

  describe("GET /all", () => {
    it("should return all users (admin)", async () => {
      const result = await controller.all();
      expect(usersService.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe("GET /pending", () => {
    it("should return pending users (admin)", async () => {
      await controller.pending();
      expect(usersService.findPending).toHaveBeenCalled();
    });
  });

  describe("PATCH /:id/status", () => {
    it("should activate user and send welcome email", async () => {
      const result = await controller.updateStatus("user-1", {
        status: "ACTIVE" as any,
      });

      expect(usersService.updateStatus).toHaveBeenCalledWith(
        "user-1",
        "ACTIVE",
      );
      expect(usersService.findById).toHaveBeenCalledWith("user-1");
      expect(mailService.sendWelcomeEmail).toHaveBeenCalled();
      expect(result).toEqual({ id: "user-1", status: "ACTIVE" });
    });

    it("should return deleted flag when rejecting", async () => {
      const result = await controller.updateStatus("user-1", {
        status: "REJECTED" as any,
      });

      expect(result).toEqual({
        id: "user-1",
        status: "REJECTED",
        deleted: true,
      });
    });
  });

  describe("PATCH /:id/role", () => {
    it("should delegate to usersService.updateRole with admin id", async () => {
      const req = mockReq({ user: { id: "admin-1", role: "ADMIN" } });
      const dto = { role: "ADMIN" as any, adminPassword: "pass" };

      await controller.updateRole("target-1", req as any, dto);

      expect(usersService.updateRole).toHaveBeenCalledWith(
        "target-1",
        "admin-1",
        dto,
      );
    });
  });

  describe("GET /:id", () => {
    it("should return user by id", async () => {
      await controller.byId("user-1");
      expect(usersService.findById).toHaveBeenCalledWith("user-1");
    });
  });
});
