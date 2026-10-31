import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'node:url';

export async function seedAuth(prisma) {
  const passwordHash = await bcrypt.hash('Admin@12345', 10);

  return prisma.user.upsert({
    where: { email: 'admin@brightloop.test' },
    update: {},
    create: {
      email: 'admin@brightloop.test',
      passwordHash,
      role: 'ADMIN',
    },
  });
}

async function main() {
  const prisma = new PrismaClient();

  try {
    await seedAuth(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('Database seed error:', error);
    process.exit(1);
  });
}
