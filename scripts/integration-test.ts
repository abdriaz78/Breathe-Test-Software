import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first"); // match the app's IPv4-first fix

import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { createPatient, listPatients, getPatient } from "@/lib/patients";
import { createTest, getTestDetail, listTests, listTestsForExport } from "@/lib/tests";
import { saveSamples, ReportLockedError } from "@/lib/samples";
import { saveDiagnosis, completeSampleCollection, getTestAuditTrail } from "@/lib/workflow";
import { loadReportData } from "@/lib/report";
import { ReportDocument } from "@/lib/pdf/ReportDocument";
import { toCsv } from "@/lib/csv";
import { createUser, listUsers } from "@/lib/admin-users";
import { createTestType, listTestTypes } from "@/lib/admin-testtypes";
import { createHospital, addDepartment, listHospitals } from "@/lib/admin-hospitals";

const ctx = { ipAddress: "127.0.0.1", userAgent: "integration-test" };
let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " -> " + detail : ""}`); }
}
async function expectThrow(name: string, fn: () => Promise<unknown>, match?: string) {
  try { await fn(); check(name, false, "did not throw"); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name, match ? msg.includes(match) : true, match ? `got: ${msg}` : "");
  }
}

async function asUser(email: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

async function warmup() {
  for (let i = 0; i < 10; i++) {
    try { await prisma.$queryRaw`select 1`; return; }
    catch { await new Promise((r) => setTimeout(r, 800)); }
  }
  throw new Error("Could not establish a DB connection after retries.");
}

async function main() {
  console.log("=== QuinTron end-to-end integration test ===\n");
  await warmup();
  console.log("DB connection established.\n");

  const nurse = await asUser("nurse@specter.health");
  const physician = await asUser("physician@specter.health");
  const admin = await asUser("admin@specter.health");
  const support = await asUser("support@specter.health");
  const hospital = await prisma.hospital.findFirstOrThrow();
  const stamp = Date.now().toString().slice(-6);

  console.log("[1] Patient registration");
  const mrn = `IT-${stamp}`;
  const { id: patientId } = await createPatient(nurse, {
    mrn, name: "Test Patient Aisha", dob: "1992-03-11", gender: "FEMALE",
    weightKg: 60, hospitalId: hospital.id, referringPhysician: "Dr. Referral",
  }, ctx);
  check("patient created", !!patientId);
  const pv = await getPatient(nurse, patientId, ctx);
  check("PHI decrypts back correctly", pv?.name === "Test Patient Aisha" && pv?.mrn === mrn, JSON.stringify(pv?.name));
  await expectThrow("duplicate MRN rejected", () => createPatient(nurse, {
    mrn, name: "Dup", dob: "1990-01-01", gender: "MALE", hospitalId: hospital.id,
  }, ctx), "already exists");
  const patients = await listPatients(nurse, { mrn });
  check("patient findable by MRN blind-index", patients.length === 1 && patients[0].id === patientId);

  console.log("\n[2] Test creation");
  const sibo = await prisma.testType.findUniqueOrThrow({ where: { key: "SIBO_GLUCOSE" } });
  const { id: testId } = await createTest(nurse, {
    patientId, testTypeId: sibo.id, substrate: "Glucose", dose: "75 g",
    collectionDate: new Date("2026-07-10"), preTestSymptoms: "bloating", preTestNotes: "fasted 12h",
  }, ctx);
  check("test created", !!testId);
  let detail = await getTestDetail(nurse, testId, ctx);
  check("new test is DRAFT", detail?.status === "DRAFT");

  console.log("\n[3] Sample entry + auto-calc + status bump");
  await saveSamples(nurse, testId, [
    { sampleNumber: 1, timeMinutes: 0, h2Ppm: 4, ch4Ppm: 2, co2Percent: 5, correctionFactor: 1, symptoms: "", skipped: false, skippedReason: "" },
    { sampleNumber: 2, timeMinutes: 20, h2Ppm: 8, ch4Ppm: 3, co2Percent: 5, correctionFactor: 1, symptoms: "", skipped: false, skippedReason: "" },
    { sampleNumber: 3, timeMinutes: 40, h2Ppm: 30, ch4Ppm: 6, co2Percent: 5, correctionFactor: 1, symptoms: "cramp", skipped: false, skippedReason: "" },
    { sampleNumber: 4, timeMinutes: 60, h2Ppm: 0, ch4Ppm: 0, co2Percent: 0, correctionFactor: 0, symptoms: "", skipped: true, skippedReason: "patient left room" },
  ], ctx);
  detail = await getTestDetail(nurse, testId, ctx);
  check("samples saved (4 rows)", detail?.samples.length === 4);
  check("status auto-bumped DRAFT -> IN_PROGRESS", detail?.status === "IN_PROGRESS");
  await expectThrow("skipped sample requires reason", () => saveSamples(nurse, testId, [
    { sampleNumber: 1, timeMinutes: 0, h2Ppm: null, ch4Ppm: null, co2Percent: null, correctionFactor: null, symptoms: "", skipped: true, skippedReason: "" },
  ], ctx), "reason");
  await expectThrow("duplicate sample number rejected", () => saveSamples(nurse, testId, [
    { sampleNumber: 1, timeMinutes: 0, h2Ppm: 1, ch4Ppm: 1, co2Percent: null, correctionFactor: null, symptoms: "", skipped: false, skippedReason: "" },
    { sampleNumber: 1, timeMinutes: 20, h2Ppm: 2, ch4Ppm: 2, co2Percent: null, correctionFactor: null, symptoms: "", skipped: false, skippedReason: "" },
  ], ctx), "Duplicate");
  // re-save the good set for the rest of the flow
  await saveSamples(nurse, testId, [
    { sampleNumber: 1, timeMinutes: 0, h2Ppm: 4, ch4Ppm: 2, co2Percent: 5, correctionFactor: 1, symptoms: "", skipped: false, skippedReason: "" },
    { sampleNumber: 2, timeMinutes: 20, h2Ppm: 8, ch4Ppm: 3, co2Percent: 5, correctionFactor: 1, symptoms: "", skipped: false, skippedReason: "" },
    { sampleNumber: 3, timeMinutes: 40, h2Ppm: 30, ch4Ppm: 6, co2Percent: 5, correctionFactor: 1, symptoms: "cramp", skipped: false, skippedReason: "" },
    { sampleNumber: 4, timeMinutes: 60, h2Ppm: 0, ch4Ppm: 0, co2Percent: 0, correctionFactor: 0, symptoms: "", skipped: true, skippedReason: "patient left room" },
  ], ctx);

  console.log("\n[4] Interpretation SUPPORT flags (not a diagnosis)");
  const report = await loadReportData(testId);
  const hasH2Flag = report?.interpretation.flags.some((f) => f.code === "H2_RISE");
  check("H2 rise (4->30 = 26 ppm) raises support flag", !!hasH2Flag);
  check("disclaimer present (no auto-diagnosis)", !!report?.interpretation.disclaimer.includes("NOT a diagnosis"));

  console.log("\n[5] RBAC negative cases");
  await expectThrow("support CANNOT mark sample collection complete", () => completeSampleCollection(support, testId, ctx), "Forbidden");
  await expectThrow("nurse CANNOT author diagnosis", () => saveDiagnosis(nurse, testId, { diagnosis: "x" }, ctx), "Forbidden");
  await expectThrow("support CANNOT create patient", () => createPatient(support, {
    mrn: `X-${stamp}`, name: "No", dob: "1990-01-01", gender: "MALE", hospitalId: hospital.id,
  }, ctx), "Forbidden");
  await expectThrow("nurse CANNOT manage users", () => createUser(nurse, {
    email: `x${stamp}@t.co`, name: "x", role: "NURSE", password: "password1",
  }, ctx), "Forbidden");

  console.log("\n[6] Sample completion (no diagnosis/physician sign-off required) + lock");
  await saveDiagnosis(physician, testId, { diagnosis: "Consistent with SIBO.", recommendation: "Rifaximin; review 6 weeks." }, ctx);
  await completeSampleCollection(nurse, testId, ctx);
  detail = await getTestDetail(physician, testId, ctx);
  check("report FINALIZED", detail?.status === "FINALIZED");
  check("finalizedAt captured", !!detail?.finalizedAt);
  await expectThrow("cannot edit samples once finalized", () => saveSamples(nurse, testId, [
    { sampleNumber: 1, timeMinutes: 0, h2Ppm: 1, ch4Ppm: 1, co2Percent: null, correctionFactor: null, symptoms: "", skipped: false, skippedReason: "" },
  ], ctx), "finalized");
  check("lock error is ReportLockedError type", (await (async () => {
    try { await saveSamples(nurse, testId, [], ctx); return false; } catch (e) { return e instanceof ReportLockedError; }
  })()));

  console.log("\n[7] FINALIZED is terminal — no reopen path");
  await expectThrow("cannot mark collection complete twice", () => completeSampleCollection(nurse, testId, ctx), "already finalized");
  const trail = await getTestAuditTrail(admin, testId);
  check("audit trail has CREATE/UPDATE/STATUS_CHANGE", ["CREATE","UPDATE","STATUS_CHANGE"].every((a) => trail.some((t) => t.action === a)));

  console.log("\n[8] Exports");
  const pdf = await renderToBuffer(ReportDocument({ data: (await loadReportData(testId))! }));
  check("PDF report renders (valid, >5KB)", pdf.length > 5000 && pdf.subarray(0, 5).toString("latin1") === "%PDF-", `${pdf.length} bytes`);
  const rows = await listTestsForExport(nurse, {});
  const csv = toCsv(["Test ID", "MRN"], rows.map((r) => [r.id, r.mrn]));
  check("tests summary CSV builds with BOM + our row", csv.charCodeAt(0) === 0xFEFF && csv.includes(mrn));
  await expectThrow("support CANNOT export (no report:export)", () => listTestsForExport(support, {}), "Forbidden");

  console.log("\n[9] Admin operations");
  const beforeUsers = (await listUsers(admin)).length;
  await createUser(admin, { email: `it-nurse-${stamp}@specter.health`, name: "IT Nurse", role: "NURSE", password: "password123" }, ctx);
  check("admin created a user", (await listUsers(admin)).length === beforeUsers + 1);
  const ttBefore = (await listTestTypes(admin)).length;
  await createTestType(admin, { name: `Custom Test ${stamp}`, defaultSubstrate: "Xylose", h2RiseFromBaselinePpm: 20 }, ctx);
  check("admin created a custom test type", (await listTestTypes(admin)).length === ttBefore + 1);
  const { id: hId } = await createHospital(admin, { name: `IT Hospital ${stamp}`, city: "Abu Dhabi" }, ctx);
  await addDepartment(admin, hId, "Radiology", ctx);
  const hlist = await listHospitals(admin);
  check("admin created hospital + department", hlist.some((h) => h.id === hId && h.departments.some((d) => d.name === "Radiology")));
  check("support CAN manage test types (read)", (await listTestTypes(support)).length > 0);

  console.log("\n[10] Cross-checks");
  const allTests = await listTests(nurse, {});
  check("created test appears in listing", allTests.some((t) => t.id === testId));

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
