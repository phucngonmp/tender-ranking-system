import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  for (const name of [RoleName.admin, RoleName.member]) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Abc@12345';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin user ${adminEmail} already exists, skipping.`);
  } else {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.admin } });
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: 'System Admin',
        roleId: adminRole.id,
        isActive: true,
      },
    });

    console.log(`Seeded admin user: ${adminEmail}`);
  }

  // --- Seed default Criteria Profile ---
  if (process.env.NODE_ENV !== 'production') {
    const criteriaName = process.env.SEED_CRITERIA_NAME || 'Dự án phần mềm & AI';
    
    const existingCriteria = await prisma.criteriaProfile.findFirst({
      where: { name: criteriaName }
    });

    if (!existingCriteria) {
      const splitAndClean = (str?: string) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
      
      await prisma.criteriaProfile.create({
        data: {
          name: criteriaName,
          industries: process.env.SEED_CRITERIA_INDUSTRIES ? splitAndClean(process.env.SEED_CRITERIA_INDUSTRIES) : ['Công nghệ thông tin', 'Phần mềm', 'Viễn thông'],
          technologies: process.env.SEED_CRITERIA_TECHNOLOGIES ? splitAndClean(process.env.SEED_CRITERIA_TECHNOLOGIES) : ['AI', 'Trí tuệ nhân tạo', 'Cloud', 'Web', 'Mobile', 'Data'],
          products: process.env.SEED_CRITERIA_PRODUCTS ? splitAndClean(process.env.SEED_CRITERIA_PRODUCTS) : ['Phần mềm', 'Ứng dụng', 'Website', 'Hệ thống', 'Giải pháp'],
          keywords: process.env.SEED_CRITERIA_KEYWORDS ? splitAndClean(process.env.SEED_CRITERIA_KEYWORDS) : ['chuyển đổi số', 'số hóa', 'thông minh', 'tích hợp', 'xây dựng phần mềm'],
          isActive: process.env.SEED_CRITERIA_IS_ACTIVE !== 'false',
        }
      });
      console.log(`Seeded default criteria profile: ${criteriaName}`);
    } else {
      console.log(`Criteria profile ${criteriaName} already exists, skipping.`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
