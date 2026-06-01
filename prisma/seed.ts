import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string, salt: string): string {
  const derived = scryptSync(password, salt, 32);
  return `${salt}:${derived.toString("hex")}`;
}

async function main() {
  const adminEmail = "admin@lagrenaille.fr";

  try {
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existing) {
      const salt = randomBytes(16).toString("hex");
      const passwordHash = hashPassword("admin123", salt);

      await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Administrateur",
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          companyName: "La Grenaille",
        },
      });
      console.log(
        "✅ Seed : Compte administrateur créé (admin@lagrenaille.fr / admin123)",
      );
    } else {
      console.log("ℹ️ Seed : Le compte administrateur existe déjà");
    }
  } catch (error) {
    console.error("❌ Erreur lors du seeding :", error);
    process.exit(1);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});

