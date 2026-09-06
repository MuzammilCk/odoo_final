import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const p = new PrismaClient();

async function main() {
  const users = await p.user.findMany();
  for (const u of users) {
    const okDemo = await bcrypt.compare('demo123', u.passwordHash);
    const okPass = await bcrypt.compare('password123', u.passwordHash);
    console.log(u.email, u.role, 'matches demo123:', okDemo, 'matches password123:', okPass);
  }

  // Set all user passwords to hash of demo123
  const newHash = await bcrypt.hash('demo123', 10);
  await p.user.updateMany({
    data: { passwordHash: newHash }
  });
  console.log('Updated all users to demo123!');

  await p.$disconnect();
}

main().catch(console.error);
