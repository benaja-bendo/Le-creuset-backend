import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string, salt: string): string {
  const derived = scryptSync(password, salt, 32);
  return `${salt}:${derived.toString('hex')}`;
}

async function main() {
  const adminEmail = 'admin@lecreuset.fr';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword('admin123', salt);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        companyName: 'Le Creuset',
      },
    });
    console.log('Seed: admin user created (admin@lecreuset.fr / admin123)');
  } else {
    console.log('Seed: admin user already exists');
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});

