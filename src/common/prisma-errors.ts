import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * Sur Postgres, `error.meta.target` d'un P2002 contient le nom de colonne en
 * base (`order_number`, via `@map`), pas le nom du champ Prisma (`orderNumber`)
 * — vérifié en pratique, pas seulement documenté. On compare donc aux deux
 * graphies plutôt que de supposer laquelle remonte.
 */
function toSnakeCase(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Traduit une violation de contrainte unique Prisma (P2002) sur `field` en
 * message clair plutôt que de laisser une 500 avec la trace Prisma remonter
 * au client. Rethrow tel quel si ce n'est pas ce cas précis.
 */
export function rethrowUniqueConstraint(
  error: unknown,
  field: string,
  message: string,
): never {
  const target = (
    error instanceof Prisma.PrismaClientKnownRequestError
      ? (error.meta?.target as string[] | undefined)
      : undefined
  )?.map((t) => t.toLowerCase());

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    target &&
    (target.includes(field.toLowerCase()) ||
      target.includes(toSnakeCase(field)))
  ) {
    throw new BadRequestException(message);
  }
  throw error;
}
