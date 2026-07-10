import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

// -----------------------------------------------------------------------------
// Seed script — demo hospital, one user per role, and the four built-in test
// types with default substrate/dose and interpretation-support thresholds.
//
// NOTE: threshold numbers below are conventional placeholders for the POC. They
// MUST be reviewed and approved by clinical stakeholders before real use.
// -----------------------------------------------------------------------------

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD || "Passw0rd!";
  const passwordHash = await bcrypt.hash(password, 10);

  // Hospital
  const hospital = await prisma.hospital.upsert({
    where: { code: "DEMO-UAE" },
    update: {},
    create: {
      name: "Specter Demo Hospital",
      code: "DEMO-UAE",
      city: "Dubai",
      country: "United Arab Emirates",
      departments: {
        create: [{ name: "Gastroenterology" }, { name: "Laboratory" }],
      },
    },
    include: { departments: true },
  });

  // Users — one per role
  const users: Array<{ email: string; name: string; role: Role; title?: string }> = [
    { email: "admin@specter.health", name: "System Admin", role: Role.ADMIN },
    { email: "nurse@specter.health", name: "Nadia Nurse", role: Role.NURSE, title: "RN" },
    { email: "physician@specter.health", name: "Dr. Omar Farouk", role: Role.PHYSICIAN, title: "Dr." },
    { email: "support@specter.health", name: "Specter Support", role: Role.SPECTER_SUPPORT },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, name: u.name, title: u.title },
      create: { email: u.email, name: u.name, role: u.role, title: u.title, passwordHash },
    });
  }

  // Built-in test types
  const testTypes = [
    {
      key: "SIBO_GLUCOSE",
      name: "SIBO — Glucose",
      defaultSubstrate: "Glucose",
      defaultDose: "75 g glucose in 250 mL water",
      interpretationRules: { h2RiseFromBaselinePpm: 20, ch4AbsolutePpm: 10 },
    },
    {
      key: "SIBO_LACTULOSE",
      name: "SIBO — Lactulose",
      defaultSubstrate: "Lactulose",
      defaultDose: "10 g lactulose in 250 mL water",
      interpretationRules: { h2RiseFromBaselinePpm: 20, ch4AbsolutePpm: 10 },
    },
    {
      key: "LACTOSE_MALABSORPTION",
      name: "Lactose Malabsorption",
      defaultSubstrate: "Lactose",
      defaultDose: "25 g lactose in 250 mL water",
      interpretationRules: { h2RiseFromBaselinePpm: 20, combinedRiseFromBaselinePpm: 15 },
    },
    {
      key: "FRUCTOSE_MALABSORPTION",
      name: "Fructose Malabsorption",
      defaultSubstrate: "Fructose",
      defaultDose: "25 g fructose in 250 mL water",
      interpretationRules: { h2RiseFromBaselinePpm: 20, combinedRiseFromBaselinePpm: 15 },
    },
  ];

  for (const t of testTypes) {
    await prisma.testType.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        defaultSubstrate: t.defaultSubstrate,
        defaultDose: t.defaultDose,
        interpretationRules: t.interpretationRules,
        isSystem: true,
      },
      create: { ...t, isSystem: true },
    });
  }

  console.log("Seed complete.");
  console.log(`Hospital: ${hospital.name} (${hospital.departments.length} departments)`);
  console.log("Demo users (password = %s):", password);
  users.forEach((u) => console.log(`  ${u.role.padEnd(16)} ${u.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
