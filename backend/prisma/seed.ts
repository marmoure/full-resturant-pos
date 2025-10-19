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

  // Create default owner
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

  // Create test users
  const testUsers = [
    { username: 'server', password: 'server123', role: 'SERVER' },
    { username: 'cashier', password: 'cashier123', role: 'CASHIER' },
    { username: 'grill', password: 'grill123', role: 'GRILL_COOK' },
    { username: 'kitchen', password: 'kitchen123', role: 'KITCHEN_STAFF' },
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

  // Seed Arabic Menu Items
  const menuItems = [
    // 🥩 Grill
    { name: 'شوا سكالوب', category: 'grill', station: 'grill', price: 850 },
    { name: 'شوا كبدة', category: 'grill', station: 'grill', price: 700 },
    { name: 'شوا كبدة دجاج', category: 'grill', station: 'grill', price: 650 },
    { name: 'شوا لحم', category: 'grill', station: 'grill', price: 900 },
    { name: 'شيش كباب', category: 'grill', station: 'grill', price: 950 },

    // 🍛 Main Course
    { name: 'مردومة', category: 'main', station: 'kitchen', price: 550 },
    { name: 'مفور خروف', category: 'main', station: 'kitchen', price: 750 },
    { name: 'مفور دجاج', category: 'main', station: 'kitchen', price: 650 },
    { name: 'طاجين فرماج', category: 'main', station: 'kitchen', price: 600 },
    { name: 'ملوخية', category: 'main', station: 'kitchen', price: 550 },
    { name: 'لوبيا', category: 'main', station: 'kitchen', price: 500 },
    { name: 'حميص', category: 'main', station: 'kitchen', price: 500 },
    { name: 'دجاج محمر', category: 'main', station: 'kitchen', price: 700 },
    { name: 'دجاج ف فور', category: 'main', station: 'kitchen', price: 700 },

    // 🍞 Sides
    { name: 'كسرة خميرة', category: 'side', station: 'kitchen', price: 100 },
    { name: 'كسرة معجونة', category: 'side', station: 'kitchen', price: 100 },
    { name: 'كسرة صغيرة', category: 'side', station: 'kitchen', price: 80 },
    { name: 'فريت', category: 'side', station: 'kitchen', price: 200 },
    { name: 'ماسيدوان', category: 'side', station: 'kitchen', price: 250 },
    { name: 'روز', category: 'side', station: 'kitchen', price: 250 },

    // 🥤 Beverages
    { name: 'ماء 1لتر', category: 'beverage', station: 'beverage', price: 70 },
    { name: 'ما صغير', category: 'beverage', station: 'beverage', price: 50 },
    { name: 'مشروبات غازية 1لتر', category: 'beverage', station: 'beverage', price: 120 },
    { name: 'مشروب غازي كانات', category: 'beverage', station: 'beverage', price: 100 },
    { name: 'مشروب غازي 33 سل', category: 'beverage', station: 'beverage', price: 90 },
    { name: 'عصير كانات', category: 'beverage', station: 'beverage', price: 100 },
    { name: 'عصير 1لتر', category: 'beverage', station: 'beverage', price: 120 },
    { name: 'عصير 33 سل', category: 'beverage', station: 'beverage', price: 80 },
  ];

  console.log('Creating menu items...');
  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
  }

  console.log('✅ Arabic menu items created');
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
