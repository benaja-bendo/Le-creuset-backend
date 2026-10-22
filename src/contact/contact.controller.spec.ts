import { Test, TestingModule } from "@nestjs/testing";
import { ArgumentMetadata } from "@nestjs/common";
import { ZodValidationException, ZodValidationPipe } from "nestjs-zod";
import { ContactController } from "./contact.controller";
import { ContactService } from "./contact.service";

describe("ContactController", () => {
  let controller: ContactController;
  let contactService: { send: jest.Mock };

  beforeEach(async () => {
    contactService = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [{ provide: ContactService, useValue: contactService }],
    }).compile();

    controller = module.get<ContactController>(ContactController);
  });

  // Rejoue ce que fait le ZodValidationPipe global (app.module.ts) sur le
  // body, avec le type déclaré par le contrôleur : prouve à la fois le schéma
  // et son branchement sur la route.
  const validateBody = (body: unknown) => {
    const [metatype] = Reflect.getMetadata(
      "design:paramtypes",
      ContactController.prototype,
      "send",
    );
    const metadata: ArgumentMetadata = { type: "body", metatype };
    return new ZodValidationPipe().transform(body, metadata);
  };

  const valid = {
    name: "Jeanne Orfèvre",
    company: "Atelier Jeanne",
    email: "jeanne@atelier.fr",
    message: "Bonjour, un devis pour 12 bagues ?",
  };

  describe("POST /contact", () => {
    it("should delegate to contactService and confirm the sending", async () => {
      const dto = validateBody(valid);
      const result = await controller.send(dto);

      expect(contactService.send).toHaveBeenCalledWith(valid);
      expect(result).toEqual(expect.objectContaining({ ok: true }));
    });

    it("should be throttled like the public auth routes", () => {
      expect(
        Reflect.getMetadata(
          "THROTTLER:LIMITdefault",
          ContactController.prototype.send,
        ),
      ).toBe(5);
      expect(
        Reflect.getMetadata(
          "THROTTLER:TTLdefault",
          ContactController.prototype.send,
        ),
      ).toBe(60_000);
    });
  });

  describe("body validation", () => {
    it("should accept a message without company and trim the fields", () => {
      expect(
        validateBody({
          name: "  Jeanne ",
          email: " jeanne@atelier.fr ",
          message: " Bonjour ",
        }),
      ).toEqual({
        name: "Jeanne",
        email: "jeanne@atelier.fr",
        message: "Bonjour",
      });
    });

    it.each([
      ["an invalid email", { ...valid, email: "jeanne@" }],
      ["a missing name", { ...valid, name: undefined }],
      ["a blank name", { ...valid, name: "   " }],
      ["a missing email", { ...valid, email: undefined }],
      ["a blank message", { ...valid, message: " \n " }],
      [
        "a message over 5000 characters",
        { ...valid, message: "a".repeat(5001) },
      ],
      ["a name over 100 characters", { ...valid, name: "a".repeat(101) }],
      ["a company over 150 characters", { ...valid, company: "a".repeat(151) }],
    ])("should reject %s", (_label, body) => {
      expect(() => validateBody(body)).toThrow(ZodValidationException);
    });

    it("should let a filled honeypot through to the service", () => {
      expect(
        validateBody({ ...valid, website: "https://spam.example" }),
      ).toEqual(expect.objectContaining({ website: "https://spam.example" }));
    });
  });
});
