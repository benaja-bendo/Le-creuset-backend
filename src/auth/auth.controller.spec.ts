import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MailService } from "../mail/mail.service";
import { ConfigService } from "@nestjs/config";
import {
  createMockMailService,
  createMockConfigService,
} from "../common/test-utils";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;
  let mailService: ReturnType<typeof createMockMailService>;

  beforeEach(async () => {
    authService = {
      register: jest
        .fn()
        .mockResolvedValue({ id: "user-1", status: "PENDING" }),
      login: jest
        .fn()
        .mockResolvedValue({ token: "jwt", user: { id: "user-1" } }),
    };
    mailService = createMockMailService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe("POST /register", () => {
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

    it("should register user and send admin notification email", async () => {
      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(mailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(mailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Nouveau compte"),
        }),
      );
      expect(result).toEqual({ id: "user-1", status: "PENDING" });
    });
  });

  describe("POST /login", () => {
    it("should delegate to authService.login", async () => {
      const dto = { email: "test@example.com", password: "password123" };
      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ token: "jwt", user: { id: "user-1" } });
    });
  });

  describe("GET /me", () => {
    it("should return the authenticated user from request", async () => {
      const req = {
        user: { id: "user-1", email: "test@example.com", role: "CLIENT" },
      };
      const result = await controller.me(req);

      expect(result).toEqual(req.user);
    });
  });

  describe("POST /logout", () => {
    it("should return { ok: true }", async () => {
      const result = await controller.logout();
      expect(result).toEqual({ ok: true });
    });
  });
});
