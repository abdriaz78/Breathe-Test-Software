import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { prisma } from "@/lib/prisma";
import { blindIndex } from "@/lib/crypto";
import type { CurrentUser } from "@/lib/session";
import { createPatient } from "@/lib/patients";
import { createTest } from "@/lib/tests";
import { saveSamples, type SampleRowInput } from "@/lib/samples";
import { saveDiagnosis, finalizeReport } from "@/lib/workflow";

const ctx = { ipAddress: "127.0.0.1", userAgent: "seed-demo" };

async function warmup() {
  for (let i = 0; i < 10; i++) {
    try { await prisma.$queryRaw`select 1`; return; }
    catch { await new Promise((r) => setTimeout(r, 800)); }
  }
  throw new Error("Could not connect to DB.");
}

async function asUser(email: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

function rows(vals: Array<[number, number, number, number]>): SampleRowInput[] {
  // [time, h2, ch4, co2]
  return vals.map(([t, h2, ch4, co2], i) => ({
    sampleNumber: i + 1,
    timeMinutes: t,
    h2Ppm: h2,
    ch4Ppm: ch4,
    co2Percent: co2,
    correctionFactor: 1.0,
    symptoms: "",
    skipped: false,
    skippedReason: "",
  }));
}

async function ensurePatient(
  nurse: CurrentUser,
  hospitalId: string,
  p: { mrn: string; name: string; dob: string; gender: "MALE" | "FEMALE"; weightKg: number; ref: string }
): Promise<string> {
  const existing = await prisma.patient.findUnique({ where: { mrnHash: blindIndex(p.mrn) } });
  if (existing) return existing.id;
  const { id } = await createPatient(nurse, {
    mrn: p.mrn, name: p.name, dob: p.dob, gender: p.gender,
    weightKg: p.weightKg, hospitalId, referringPhysician: p.ref,
  }, ctx);
  return id;
}

async function main() {
  await warmup();
  console.log("Connected. Seeding demo records...\n");

  const nurse = await asUser("nurse@specter.health");
  const physician = await asUser("physician@specter.health");
  const hospital = await prisma.hospital.findFirstOrThrow();
  const dept = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });

  const typeByKey = async (key: string) =>
    (await prisma.testType.findUniqueOrThrow({ where: { key } }));
  const sibo = await typeByKey("SIBO_GLUCOSE");
  const lactose = await typeByKey("LACTOSE_MALABSORPTION");
  const lactulose = await typeByKey("SIBO_LACTULOSE");

  const created: Array<{ label: string; testId: string; status: string }> = [];

  async function makeTest(opts: {
    patientId: string; typeId: string; substrate: string; dose: string;
    samples: SampleRowInput[]; finalize?: { diagnosis: string; recommendation: string };
    preSymptoms: string; label: string;
  }) {
    const { id: testId } = await createTest(nurse, {
      patientId: opts.patientId, testTypeId: opts.typeId,
      departmentId: dept?.id, substrate: opts.substrate, dose: opts.dose,
      collectionDate: new Date(), analysisDate: new Date(),
      preTestSymptoms: opts.preSymptoms, preTestNotes: "Fasted 12h. No antibiotics in prior 4 weeks.",
    }, ctx);
    await saveSamples(nurse, testId, opts.samples, ctx);
    let status = "IN_PROGRESS";
    if (opts.finalize) {
      await saveDiagnosis(physician, testId, opts.finalize, ctx);
      await finalizeReport(physician, testId, opts.finalize, ctx);
      status = "FINALIZED";
    }
    created.push({ label: opts.label, testId, status });
  }

  // --- Patient 1: positive SIBO glucose, finalized ---
  const p1 = await ensurePatient(nurse, hospital.id, {
    mrn: "DEMO-1001", name: "Aisha Al Mansoori", dob: "1990-05-14", gender: "FEMALE", weightKg: 63, ref: "Dr. Layla Haddad",
  });
  await makeTest({
    patientId: p1, typeId: sibo.id, substrate: "Glucose", dose: "75 g glucose in 250 mL water",
    preSymptoms: "bloating, abdominal discomfort", label: "Aisha - SIBO Glucose (FINALIZED, positive)",
    samples: rows([[0, 4, 2, 5.1], [20, 6, 3, 5.0], [40, 14, 4, 4.9], [60, 28, 7, 4.8], [80, 33, 9, 4.7], [100, 26, 11, 4.7]]),
    finalize: {
      diagnosis: "Findings consistent with small intestinal bacterial overgrowth (SIBO). Early H2 rise exceeding the configured threshold.",
      recommendation: "Consider a course of rifaximin. Repeat breath testing in 6 weeks. Dietary review advised.",
    },
  });

  // --- Patient 2: lactose malabsorption, finalized ---
  const p2 = await ensurePatient(nurse, hospital.id, {
    mrn: "DEMO-1002", name: "Mohammed Rahman", dob: "1985-11-02", gender: "MALE", weightKg: 82, ref: "Dr. Omar Farouk",
  });
  await makeTest({
    patientId: p2, typeId: lactose.id, substrate: "Lactose", dose: "25 g lactose in 250 mL water",
    preSymptoms: "cramping after dairy", label: "Mohammed - Lactose (FINALIZED)",
    samples: rows([[0, 3, 5, 5.2], [30, 5, 6, 5.1], [60, 12, 8, 5.0], [90, 24, 10, 4.9], [120, 30, 12, 4.8]]),
    finalize: {
      diagnosis: "Results support lactose malabsorption; symptomatic H2 rise following lactose challenge.",
      recommendation: "Trial of lactose-restricted diet and/or lactase supplementation. Dietitian referral.",
    },
  });

  // --- Patient 3: SIBO lactulose, left IN PROGRESS (not signed) ---
  const p3 = await ensurePatient(nurse, hospital.id, {
    mrn: "DEMO-1003", name: "Sara Ahmed", dob: "1998-02-20", gender: "FEMALE", weightKg: 55, ref: "Dr. Layla Haddad",
  });
  await makeTest({
    patientId: p3, typeId: lactulose.id, substrate: "Lactulose", dose: "10 g lactulose in 250 mL water",
    preSymptoms: "gas, irregular bowel habit", label: "Sara - SIBO Lactulose (IN PROGRESS, awaiting physician)",
    samples: rows([[0, 5, 3, 5.0], [20, 7, 4, 5.0], [40, 9, 5, 4.9], [60, 13, 6, 4.9], [80, 16, 8, 4.8], [100, 18, 9, 4.8]]),
  });

  console.log("Seeded records:\n");
  for (const c of created) {
    console.log(`  [${c.status}] ${c.label}`);
    console.log(`     open : http://localhost:3000/tests/${c.testId}`);
    console.log(`     PDF  : http://localhost:3000/api/tests/${c.testId}/report\n`);
  }
  console.log("Log in (e.g. physician@specter.health / Passw0rd!) first, then open the links.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
