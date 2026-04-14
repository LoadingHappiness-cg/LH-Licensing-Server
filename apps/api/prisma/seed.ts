import "dotenv/config";
import { PrismaClient, LicenseStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.upsert({
    where: { code: "ETIQUETAS_GS1" },
    update: {
      name: "Etiquetas GS1",
      isActive: true
    },
    create: {
      code: "ETIQUETAS_GS1",
      name: "Etiquetas GS1",
      isActive: true
    }
  });

  const plan = await prisma.licensePlan.upsert({
    where: {
      productId_code: {
        productId: product.id,
        code: "BASIC_LOCAL"
      }
    },
    update: {
      name: "Basic Local",
      durationDays: 30,
      maxCompanies: 1,
      maxWorkstations: 1,
      entitlements: {
        printing: true,
        refresh: true,
        localTesting: true
      },
      isActive: true
    },
    create: {
      productId: product.id,
      code: "BASIC_LOCAL",
      name: "Basic Local",
      durationDays: 30,
      maxCompanies: 1,
      maxWorkstations: 1,
      entitlements: {
        printing: true,
        refresh: true,
        localTesting: true
      },
      isActive: true
    }
  });

  const customer = await prisma.customer.upsert({
    where: { code: "LOADING_HAPPINESS_INTERNAL" },
    update: {
      name: "Loading Happiness Internal",
      email: "internal@loadinghappiness.pt",
      isActive: true
    },
    create: {
      code: "LOADING_HAPPINESS_INTERNAL",
      name: "Loading Happiness Internal",
      email: "internal@loadinghappiness.pt",
      isActive: true
    }
  });

  await prisma.license.upsert({
    where: { licenseKey: "LH-GS1-LOCAL-0001" },
    update: {
      customerId: customer.id,
      productId: product.id,
      planId: plan.id,
      status: LicenseStatus.ACTIVE,
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
      notes: "Seeded license for local admin testing",
      overrides: {
        source: "seed"
      }
    },
    create: {
      licenseKey: "LH-GS1-LOCAL-0001",
      customerId: customer.id,
      productId: product.id,
      planId: plan.id,
      status: LicenseStatus.ACTIVE,
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
      notes: "Seeded license for local admin testing",
      overrides: {
        source: "seed"
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
