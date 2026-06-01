import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { MailService } from "./mail.service";
import { createMockConfigService } from "../common/test-utils";

// Mock nodemailer
jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "smtp-msg-1" }),
  }),
}));

// Mock Resend
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({
        data: { id: "resend-msg-1" },
        error: null,
      }),
    },
  })),
}));

describe("MailService", () => {
  describe("with no transport configured", () => {
    let service: MailService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: createMockConfigService({
              RESEND_API_KEY: "",
              SMTP_HOST: "",
              SMTP_PORT: "",
            }),
          },
        ],
      }).compile();

      service = module.get<MailService>(MailService);
    });

    it("should return success without sending (no transport)", async () => {
      const result = await service.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<h1>Test</h1>",
      });

      expect(result).toEqual({ id: "", success: true });
    });
  });

  describe("with SMTP configured", () => {
    let service: MailService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: createMockConfigService({
              RESEND_API_KEY: "",
              SMTP_HOST: "localhost",
              SMTP_PORT: "1025",
            }),
          },
        ],
      }).compile();

      service = module.get<MailService>(MailService);
    });

    it("should send email via SMTP transport", async () => {
      const result = await service.sendEmail({
        to: "test@example.com",
        subject: "SMTP Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe("smtp-msg-1");
    });
  });

  describe("with Resend configured", () => {
    let service: MailService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: createMockConfigService({
              RESEND_API_KEY: "re_test_1234",
              SMTP_HOST: "",
              SMTP_PORT: "",
            }),
          },
        ],
      }).compile();

      service = module.get<MailService>(MailService);
    });

    it("should send email via Resend API", async () => {
      const result = await service.sendEmail({
        to: "test@example.com",
        subject: "Resend Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe("resend-msg-1");
    });
  });

  describe("template methods", () => {
    let service: MailService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: createMockConfigService(),
          },
        ],
      }).compile();

      service = module.get<MailService>(MailService);
      // Spy on sendEmail to verify templates call it
      jest
        .spyOn(service, "sendEmail")
        .mockResolvedValue({ id: "test", success: true });
    });

    it("sendWelcomeEmail should call sendEmail with activation subject", async () => {
      await service.sendWelcomeEmail("user@example.com");

      expect(service.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining("activé"),
        }),
      );
    });

    it("sendOrderCompletedEmail should include order ref and invoice number", async () => {
      await service.sendOrderCompletedEmail(
        "user@example.com",
        "abc123",
        "INV-001",
        500,
      );

      expect(service.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("abc123"),
          html: expect.stringContaining("INV-001"),
        }),
      );
    });

    it("sendQuoteConfirmation should include quote reference", async () => {
      await service.sendQuoteConfirmation(
        "user@example.com",
        "QUO-001",
        "http://localhost/quote/QUO-001",
      );

      expect(service.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("QUO-001"),
        }),
      );
    });

    it("sendAdminNotification should include quote ref and customer", async () => {
      await service.sendAdminNotification("QUO-002", "client@test.com", 3);

      expect(service.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("QUO-002"),
          html: expect.stringContaining("client@test.com"),
        }),
      );
    });
  });
});
