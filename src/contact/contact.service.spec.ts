import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import { ContactService } from "./contact.service";
import { MailService } from "../mail/mail.service";
import {
  createMockConfigService,
  createMockMailService,
} from "../common/test-utils";

describe("ContactService", () => {
  let mailService: ReturnType<typeof createMockMailService>;

  const dto = {
    name: "Jeanne Orfèvre",
    company: "Atelier Jeanne",
    email: "jeanne@atelier.fr",
    message: "Bonjour,\nPouvez-vous fondre 12 bagues en or jaune ?",
  };

  const build = async (config: Record<string, string> = {}) => {
    mailService = createMockMailService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: createMockConfigService(config) },
      ],
    }).compile();
    return module.get<ContactService>(ContactService);
  };

  const sentEmail = () => mailService.sendEmail.mock.calls[0][0];

  it("should send the message to contact@lagrenaille.fr by default, replying to the visitor", async () => {
    const service = await build();

    await service.send(dto);

    expect(mailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(sentEmail()).toEqual(
      expect.objectContaining({
        to: "contact@lagrenaille.fr",
        replyTo: "jeanne@atelier.fr",
        subject: "Demande de contact — Atelier Jeanne",
      }),
    );
    expect(sentEmail().text).toContain(
      "Pouvez-vous fondre 12 bagues en or jaune ?",
    );
  });

  it("should send to CONTACT_EMAIL when configured", async () => {
    const service = await build({ CONTACT_EMAIL: "atelier@example.com" });

    await service.send(dto);

    expect(sentEmail().to).toBe("atelier@example.com");
  });

  it("should fall back to the default address when CONTACT_EMAIL is empty", async () => {
    const service = await build({ CONTACT_EMAIL: "" });

    await service.send(dto);

    expect(sentEmail().to).toBe("contact@lagrenaille.fr");
  });

  it("should escape every visitor field in the HTML body", async () => {
    const service = await build();

    await service.send({
      name: `<img src=x onerror="alert(1)">`,
      company: "<b>ACME</b>",
      email: "jeanne@atelier.fr",
      message: `<a href="https://phishing.example">Payez ici</a>\n<script>x()</script>`,
    });

    const { html } = sentEmail();
    expect(html).not.toMatch(/<(img|b|a|script)\b/);
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;b&gt;ACME&lt;/b&gt;");
    expect(html).toContain(
      "&lt;a href=&quot;https://phishing.example&quot;&gt;Payez ici&lt;/a&gt;<br />&lt;script&gt;",
    );
  });

  it("should keep the subject on a single line", async () => {
    const service = await build();

    await service.send({
      ...dto,
      company: undefined,
      name: "Jeanne\r\nBcc: tous@example.com",
    });

    expect(sentEmail().subject).toBe(
      "Demande de contact — Jeanne Bcc: tous@example.com",
    );
  });

  it("should omit the company line when none is given", async () => {
    const service = await build();

    await service.send({ ...dto, company: undefined });

    expect(sentEmail().html).not.toContain("Société");
    expect(sentEmail().text).not.toContain("Société");
    expect(sentEmail().subject).toBe("Demande de contact — Jeanne Orfèvre");
  });

  it("should silently drop a message whose honeypot is filled", async () => {
    const service = await build();

    await expect(
      service.send({ ...dto, website: "https://spam.example" }),
    ).resolves.toBeUndefined();
    expect(mailService.sendEmail).not.toHaveBeenCalled();
  });

  it("should throw when the email could not be sent", async () => {
    const service = await build();
    mailService.sendEmail.mockResolvedValue({ id: "", success: false });

    await expect(service.send(dto)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
