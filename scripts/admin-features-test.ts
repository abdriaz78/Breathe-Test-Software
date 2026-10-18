import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first"); // match the app's IPv4-first fix

import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { createPatient } from "@/lib/patients";
import { createTest } from "@/lib/tests";
import { saveSamples, ReportLockedError } from "@/lib/samples";
import { startTimer, acknowledgeSample, deleteTimer, listActiveTimers, receivesReminders } from "@/lib/timers";
import { completeSampleCollection } from "@/lib/workflow";
import {
  createHospital, updateHospital, deleteHospital, addDepartment, listHospitals,
} from "@/lib/admin-hospitals";
import { can } from "@/lib/rbac";

// Covers: admin hospital edit/delete and admin deletion of sample reminders.
// Every record it creates is tagged with the run stamp and removed at the end.

const UA = "admin-features-test";
const ctx = { ipAddress: "127.0.0.1", userAgent: UA };
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
  return { id: u.id, name: u.name, email: u.email, role: u.role, hospitalId: u.hospitalId };
}
async function lastAudit(entityId: string) {
  return prisma.auditLog.findFirst({ where: { entityId }, orderBy: { createdAt: "desc" } });
}

const created = { hospitals: [] as string[], patients: [] as string[], tests: [] as string[], users: [] as string[] };

async function main() {
  console.log("=== Admin features test: hospital edit/delete + reminder delete ===\n");
  for (let i = 0; i < 10; i++) {
    try { await prisma.$queryRaw`select 1`; break; }
    catch { await new Promise((r) => setTimeout(r, 800)); }
  }

  const admin = await asUser("admin@specter.health");
  const nurse = await asUser("nurse@specter.health");
  const physician = await asUser("physician@specter.health");
  const support = await asUser("support@specter.health");
  const stamp = Date.now().toString().slice(-7);
  const T = (s: string) => `ZZTEST ${s} ${stamp}`;

  // ---------------------------------------------------------------- edit ---
  console.log("[1] Edit hospital");
  const a = await createHospital(admin, { name: T("Alpha"), code: `ZA${stamp}`, city: "Dubai", country: "" }, ctx);
  const b = await createHospital(admin, { name: T("Beta"), code: `ZB${stamp}`, city: "", country: "" }, ctx);
  created.hospitals.push(a.id, b.id);

  await updateHospital(admin, a.id, { name: T("Alpha Renamed"), code: `ZA2${stamp}`, city: "Abu Dhabi", country: "Oman" }, ctx);
  let ha = await prisma.hospital.findUniqueOrThrow({ where: { id: a.id } });
  check("admin can rename + change code/city/country",
    ha.name === T("Alpha Renamed") && ha.code === `ZA2${stamp}` && ha.city === "Abu Dhabi" && ha.country === "Oman",
    JSON.stringify(ha));
  const au = await lastAudit(a.id);
  const meta = au?.metadata as { changed?: string[]; before?: Record<string, unknown> } | null;
  check("UPDATE audit row records changed fields + old values",
    au?.action === "UPDATE" && meta?.changed?.length === 4 && meta?.before?.city === "Dubai",
    JSON.stringify(au?.metadata));

  await updateHospital(admin, a.id, { name: T("Alpha Renamed"), code: `ZA2${stamp}`, city: "Abu Dhabi", country: "Oman" }, ctx);
  check("no-op save writes no extra audit row", (await lastAudit(a.id))?.id === au?.id);

  await updateHospital(admin, a.id, { name: T("Alpha Renamed"), code: `ZA2${stamp}`, city: "Abu Dhabi", country: "Oman" }, ctx)
    .then(() => check("saving with its own unchanged code is allowed", true))
    .catch((e) => check("saving with its own unchanged code is allowed", false, String(e)));

  await expectThrow("code already used by another hospital is rejected",
    () => updateHospital(admin, a.id, { name: T("Alpha Renamed"), code: `ZB${stamp}`, city: "", country: "" }, ctx),
    "already exists");
  ha = await prisma.hospital.findUniqueOrThrow({ where: { id: a.id } });
  check("rejected edit left the record unchanged", ha.code === `ZA2${stamp}` && ha.city === "Abu Dhabi");

  await updateHospital(admin, a.id, { name: T("Alpha Renamed"), code: "", city: "", country: "" }, ctx);
  ha = await prisma.hospital.findUniqueOrThrow({ where: { id: a.id } });
  check("blank code/city clear to null; blank country falls back to default",
    ha.code === null && ha.city === null && ha.country === "United Arab Emirates", JSON.stringify(ha));

  await expectThrow("empty name rejected",
    () => updateHospital(admin, a.id, { name: "  ", code: "", city: "", country: "" }, ctx));
  await expectThrow("unknown hospital id -> not found",
    () => updateHospital(admin, "does-not-exist", { name: "x", code: "", city: "", country: "" }, ctx), "not found");
  await expectThrow("nurse CANNOT edit a hospital",
    () => updateHospital(nurse, a.id, { name: "hack", code: "", city: "", country: "" }, ctx), "Forbidden");
  await expectThrow("physician CANNOT edit a hospital",
    () => updateHospital(physician, a.id, { name: "hack", code: "", city: "", country: "" }, ctx), "Forbidden");
  await updateHospital(support, b.id, { name: T("Beta"), code: `ZB${stamp}`, city: "Sharjah", country: "" }, ctx);
  check("support (hospital:manage) CAN edit a hospital",
    (await prisma.hospital.findUniqueOrThrow({ where: { id: b.id } })).city === "Sharjah");

  // -------------------------------------------------------------- delete ---
  console.log("\n[2] Delete hospital");
  await addDepartment(admin, a.id, "Gastro", ctx);
  await addDepartment(admin, a.id, "Endoscopy", ctx);
  const deptsBefore = await prisma.department.findMany({ where: { hospitalId: a.id } });
  check("setup: empty hospital has 2 departments", deptsBefore.length === 2);

  await expectThrow("nurse CANNOT delete a hospital", () => deleteHospital(nurse, a.id, ctx), "Forbidden");
  await expectThrow("physician CANNOT delete a hospital", () => deleteHospital(physician, a.id, ctx), "Forbidden");
  await expectThrow("unknown hospital id -> not found", () => deleteHospital(admin, "does-not-exist", ctx), "not found");

  // Hospital with a patient must be protected.
  const { id: bPatient } = await createPatient(admin, {
    mrn: `ZZT-${stamp}`, name: "ZZ Test Patient", dob: "1990-01-01", gender: "MALE", hospitalId: b.id,
  }, ctx);
  created.patients.push(bPatient);
  await expectThrow("hospital WITH patients cannot be deleted", () => deleteHospital(admin, b.id, ctx), "patient");
  check("…and it still exists", !!(await prisma.hospital.findUnique({ where: { id: b.id } })));

  // Hospital with a staff account (no patients) must be protected too.
  const c = await createHospital(admin, { name: T("Gamma"), code: "", city: "", country: "" }, ctx);
  created.hospitals.push(c.id);
  const staff = await prisma.user.create({
    data: { email: `zztest-${stamp}@example.invalid`, name: "ZZ Test Nurse", passwordHash: "x", role: "NURSE", hospitalId: c.id },
  });
  created.users.push(staff.id);
  await expectThrow("hospital WITH staff accounts cannot be deleted", () => deleteHospital(admin, c.id, ctx), "staff");
  check("…and it still exists", !!(await prisma.hospital.findUnique({ where: { id: c.id } })));

  const listed = await listHospitals(admin);
  const lc = listed.find((h) => h.id === c.id);
  const lb = listed.find((h) => h.id === b.id);
  check("listHospitals reports staff + patient counts for the UI",
    lc?._count.users === 1 && lb?._count.patients === 1, JSON.stringify([lc?._count, lb?._count]));

  // A test in ANOTHER hospital that points at one of A's departments: deleting
  // A must not fail on the FK, and must not delete that test.
  const sibo = await prisma.testType.findUniqueOrThrow({ where: { key: "SIBO_GLUCOSE" } });
  const { id: crossTest } = await createTest(admin, { patientId: bPatient, testTypeId: sibo.id }, ctx);
  created.tests.push(crossTest);
  await prisma.breathTest.update({ where: { id: crossTest }, data: { departmentId: deptsBefore[0].id } });

  await deleteHospital(admin, a.id, ctx);
  check("empty hospital deleted", !(await prisma.hospital.findUnique({ where: { id: a.id } })));
  check("its departments were deleted with it",
    (await prisma.department.count({ where: { id: { in: deptsBefore.map((d) => d.id) } } })) === 0);
  const ct = await prisma.breathTest.findUnique({ where: { id: crossTest } });
  check("a test that referenced one of its departments survives (department cleared)",
    !!ct && ct.departmentId === null, JSON.stringify(ct?.departmentId));
  const ad = await lastAudit(a.id);
  check("DELETE audit row written", ad?.action === "DELETE" && ad.summary?.includes("Deleted hospital") === true);
  created.hospitals = created.hospitals.filter((id) => id !== a.id);

  // ----------------------------------------------------------- reminders ---
  console.log("\n[3] Delete sample reminders (admin only)");
  check("RBAC: only ADMIN holds timer:delete",
    can("ADMIN", "timer:delete") && !can("NURSE", "timer:delete") &&
    !can("PHYSICIAN", "timer:delete") && !can("SPECTER_SUPPORT", "timer:delete"));

  const nurseHospital = nurse.hospitalId!;
  const { id: p2 } = await createPatient(nurse, {
    mrn: `ZZT2-${stamp}`, name: "ZZ Timer Patient", dob: "1985-05-05", gender: "FEMALE", hospitalId: nurseHospital,
  }, ctx);
  created.patients.push(p2);
  const { id: t1 } = await createTest(nurse, { patientId: p2, testTypeId: sibo.id }, ctx);
  created.tests.push(t1);

  await expectThrow("deleting when no reminders exist gives a clear error",
    () => deleteTimer(admin, t1, ctx), "no sample reminders");

  await saveSamples(nurse, t1, [
    { sampleNumber: 1, timeMinutes: 0, h2Ppm: 4, ch4Ppm: 2, co2Percent: 5, correctionFactor: 1, symptoms: "", skipped: false, skippedReason: "" },
    { sampleNumber: 2, timeMinutes: 30, h2Ppm: 9, ch4Ppm: 3, co2Percent: 5, correctionFactor: 1, symptoms: "", skipped: false, skippedReason: "" },
  ], ctx);
  await startTimer(nurse, t1, { intervalMinutes: 30, totalSamples: 7 }, ctx);
  await acknowledgeSample(nurse, t1, 1, ctx);
  const sees = async (u: CurrentUser, testId: string) => (await listActiveTimers(u)).some((t) => t.testId === testId);
  check("creating nurse sees the reminder", await sees(nurse, t1));
  check("admin does NOT see the reminder", !(await sees(admin, t1)));
  check("physician does NOT see the reminder", !(await sees(physician, t1)));
  check("support does NOT see the reminder", !(await sees(support, t1)));
  check("admin/physician/support get no reminders at all",
    (await listActiveTimers(admin)).length === 0 && (await listActiveTimers(physician)).length === 0 &&
    (await listActiveTimers(support)).length === 0);

  // Another nurse in the SAME hospital must not see it either.
  const nurseB = await prisma.user.create({
    data: { email: `zztest-b-${stamp}@example.invalid`, name: "ZZ Test Nurse B", passwordHash: "x", role: "NURSE", hospitalId: nurseHospital },
  });
  created.users.push(nurseB.id);
  const nb: CurrentUser = { id: nurseB.id, name: nurseB.name, email: nurseB.email, role: "NURSE", hospitalId: nurseHospital };
  check("other nurse in the same hospital does NOT see it", !(await sees(nb, t1)));
  check("receivesReminders: creator nurse only",
    receivesReminders(nurse, nurse.id) && !receivesReminders(nb, nurse.id) && !receivesReminders(admin, admin.id));

  // ...even if that other nurse is the one who starts the timer: reminders follow the test creator.
  const { id: t2 } = await createTest(nurse, { patientId: p2, testTypeId: sibo.id }, ctx);
  created.tests.push(t2);
  await startTimer(nb, t2, { intervalMinutes: 30, totalSamples: 3 }, ctx);
  check("timer started by another nurse still reminds only the creator", (await sees(nurse, t2)) && !(await sees(nb, t2)));
  await acknowledgeSample(nb, t2, 1, ctx)
    .then(() => check("same-hospital colleague can still acknowledge from the test page", true))
    .catch((e) => check("same-hospital colleague can still acknowledge from the test page", false, String(e)));
  check("creator's reminder advanced to sample 2",
    (await listActiveTimers(nurse)).find((t) => t.testId === t2)?.nextSampleIndex === 2);

  // A test created by the admin reminds nobody.
  const { id: t3 } = await createTest(admin, { patientId: p2, testTypeId: sibo.id }, ctx);
  created.tests.push(t3);
  await startTimer(nurse, t3, { intervalMinutes: 30, totalSamples: 3 }, ctx);
  check("admin-created test: no reminders for anyone",
    !(await sees(admin, t3)) && !(await sees(nurse, t3)) && !(await sees(nb, t3)));

  await expectThrow("nurse CANNOT delete reminders", () => deleteTimer(nurse, t1, ctx), "Forbidden");
  await expectThrow("physician CANNOT delete reminders", () => deleteTimer(physician, t1, ctx), "Forbidden");
  await expectThrow("support CANNOT delete reminders", () => deleteTimer(support, t1, ctx), "Forbidden");
  await expectThrow("unknown test id -> not found", () => deleteTimer(admin, "does-not-exist", ctx), "not found");

  const before = await prisma.breathTest.findUniqueOrThrow({ where: { id: t1 } });
  await deleteTimer(admin, t1, ctx);
  const after = await prisma.breathTest.findUniqueOrThrow({ where: { id: t1 }, include: { samples: true } });
  check("admin deleted reminders: schedule fully cleared",
    after.timerStartedAt === null && after.timerTotalSamples === null &&
    after.timerAckedIndex === 0 && after.timerEndedAt === null, JSON.stringify(after));
  check("reminder gone from the creating nurse's list", !(await sees(nurse, t1)));
  check("sample data untouched (2 rows, same values)",
    after.samples.length === 2 && after.samples.some((s) => Number(s.h2Ppm) === 9));
  check("report status unchanged", after.status === before.status, `${before.status} -> ${after.status}`);
  const td = await prisma.auditLog.findFirst({ where: { breathTestId: t1, action: "DELETE" }, orderBy: { createdAt: "desc" } });
  check("DELETE audit row with old schedule",
    !!td && (td.metadata as { totalSamples?: number; ackedIndex?: number })?.totalSamples === 7 &&
    (td.metadata as { ackedIndex?: number }).ackedIndex === 1, JSON.stringify(td?.metadata));

  await expectThrow("deleting twice gives a clear error", () => deleteTimer(admin, t1, ctx), "no sample reminders");
  await expectThrow("acknowledging after delete is refused", () => acknowledgeSample(nurse, t1, 2, ctx), "No collection timer");

  await startTimer(nurse, t1, { intervalMinutes: 15, totalSamples: 4 }, ctx);
  const restarted = await prisma.breathTest.findUniqueOrThrow({ where: { id: t1 } });
  check("a fresh schedule can be started after delete",
    !!restarted.timerStartedAt && restarted.timerIntervalMin === 15 && restarted.timerAckedIndex === 0);

  // Completed (ended) schedule can also be removed.
  for (const i of [1, 2, 3]) await acknowledgeSample(nurse, t1, i, ctx);
  check("setup: schedule completed", !!(await prisma.breathTest.findUniqueOrThrow({ where: { id: t1 } })).timerEndedAt);
  await deleteTimer(admin, t1, ctx);
  check("completed schedule can be deleted",
    (await prisma.breathTest.findUniqueOrThrow({ where: { id: t1 } })).timerStartedAt === null);

  // Finalized reports are locked.
  await startTimer(nurse, t1, { intervalMinutes: 30, totalSamples: 7 }, ctx);
  await completeSampleCollection(nurse, t1, ctx);
  try { await deleteTimer(admin, t1, ctx); check("FINALIZED report: reminder delete refused (locked)", false, "did not throw"); }
  catch (e) { check("FINALIZED report: reminder delete refused (locked)", e instanceof ReportLockedError, String(e)); }
  check("…and its timer history is kept",
    !!(await prisma.breathTest.findUniqueOrThrow({ where: { id: t1 } })).timerStartedAt);
}

async function cleanup() {
  const tests = created.tests;
  const ids = [...created.hospitals, ...created.patients, ...tests, ...created.users];
  await prisma.auditLog.deleteMany({
    where: { OR: [{ breathTestId: { in: tests } }, { entityId: { in: ids } }, { userAgent: UA }] },
  });
  await prisma.breathTest.deleteMany({ where: { id: { in: tests } } });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  const leftover = await prisma.hospital.count({ where: { name: { startsWith: "ZZTEST" } } });
  console.log(`\nCleanup done (leftover ZZTEST hospitals: ${leftover}).`);
}

main()
  .catch((e) => { fail++; console.error("FATAL", e); })
  .finally(async () => {
    try { await cleanup(); } catch (e) { console.error("CLEANUP FAILED", e); fail++; }
    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
    await prisma.$disconnect();
    process.exit(fail ? 1 : 0);
  });
