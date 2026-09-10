import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { rethrowUniqueConstraint } from "./prisma-errors";

function fakeUniqueConstraintError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.0.0",
    meta: { target },
  });
}

describe("rethrowUniqueConstraint", () => {
  it("should convert a P2002 on the given field into a BadRequestException", () => {
    const error = fakeUniqueConstraintError(["invoiceNumber"]);

    expect(() =>
      rethrowUniqueConstraint(error, "invoiceNumber", "Numéro déjà utilisé."),
    ).toThrow(BadRequestException);
  });

  it("should match Postgres's snake_case column name (real Prisma behaviour, not just the camelCase field name)", () => {
    // Constaté en pratique sur ce projet : un P2002 sur `orderNumber` (mappé
    // `@map("order_number")`) remonte `meta.target: ["order_number"]`, pas
    // `["orderNumber"]`. Un test qui ne couvre que la graphie camelCase
    // passerait alors qu'un vrai P2002 en base ferait fuiter une 500.
    const error = fakeUniqueConstraintError(["order_number"]);

    expect(() =>
      rethrowUniqueConstraint(error, "orderNumber", "Numéro déjà utilisé."),
    ).toThrow(BadRequestException);
  });

  it("should rethrow a P2002 on a different field unchanged", () => {
    const error = fakeUniqueConstraintError(["email"]);

    expect(() =>
      rethrowUniqueConstraint(error, "invoiceNumber", "Numéro déjà utilisé."),
    ).toThrow(error);
  });

  it("should rethrow a non-Prisma error unchanged", () => {
    const error = new Error("boom");

    expect(() =>
      rethrowUniqueConstraint(error, "invoiceNumber", "Numéro déjà utilisé."),
    ).toThrow(error);
  });
});
