import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed Roles
  const roles = [
    { name: 'OWNER' },
    { name: 'SERVER' },
    { name: 'CASHIER' },
    { name: 'GRILL_COOK' },
    { name: 'KITCHEN_STAFF' },
  ];

  console.log('Creating roles...');
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log('✅ Roles created');

  // Create default owner account for testing
  const ownerRole = await prisma.role.findUnique({
    where: { name: 'OWNER' },
  });

  if (ownerRole) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        password: hashedPassword,
        roleId: ownerRole.id,
      },
    });
    console.log('✅ Default owner account created (username: admin, password: admin123)');
  }

  // Create test users for each role
  const testUsers = [
    { username: 'server1', password: 'server123', role: 'SERVER' },
    { username: 'cashier1', password: 'cashier123', role: 'CASHIER' },
    { username: 'grill1', password: 'grill123', role: 'GRILL_COOK' },
    { username: 'kitchen1', password: 'kitchen123', role: 'KITCHEN_STAFF' },
  ];

  console.log('Creating test users...');
  for (const user of testUsers) {
    const role = await prisma.role.findUnique({
      where: { name: user.role },
    });

    if (role) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await prisma.user.upsert({
        where: { username: user.username },
        update: {},
        create: {
          username: user.username,
          password: hashedPassword,
          roleId: role.id,
        },
      });
    }
  }
  console.log('✅ Test users created');

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
