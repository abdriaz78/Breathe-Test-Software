import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

// -----------------------------------------------------------------------------
// Patient portal + multi-hospital isolation test suite.
//
//   npx tsx scripts/portal-security-test.ts
//
// Needs a seeded database (npm run db:seed). Creates its own throwaway
// hospital/staff/patients with a unique suffix, so it can run repeatedly.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { staffFromSession, patientFromSession, hospitalScope, isOutsideScope } from "@/lib/session";
import { isHospitalScoped, can } from "@/lib/rbac";
import { createPatient, getPatient, listPatientsPage } from "@/lib/patients";
import { createTest, getTestDetail, listTestsForExport, listTestsPage } from "@/lib/tests";
import { saveSamples } from "@/lib/samples";
import { completeSampleCollection, saveDiagnosis, getTestAuditTrail } from "@/lib/workflow";
import { createUser, setUserActive, resetUserPassword } from "@/lib/admin-users";
import { createHospital, addDepartment } from "@/lib/admin-hospitals";
import {
  issuePortalAccess, disablePortalAccess, getPortalAccess,
  listOwnReports, loadOwnReport, changeOwnPassword, getOwnProfile, generateTempPassword,
} from "@/lib/portal";
import {
  verifyStaffCredentials, verifyPatientCredentials, revalidateSession,
  AccountLockedError, MAX_FAILED_ATTEMPTS,
} from "@/lib/credentials";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import type { Session } from "next-auth";

const ctx = { ipAddress: "127.0.0.1", userAgent: "portal-security-test" };
let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " -> " + detail : ""}`); }
}
async function expectThrow(name: string, fn: () => Promise<unknown>, match?: string | RegExp) {
  try { await fn(); check(name, false, "did not throw"); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const ok = !match ? true : typeof match === "string" ? msg.includes(match) : match.test(msg);
    check(name, ok, `got: ${msg}`);
  }
}
async function asUser(email: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, hospitalId: u.hospitalId };
}

async function finalizedTest(actor: CurrentUser, patientId: string, testTypeId: string) {
  const { id } = await createTest(actor, { patientId, testTypeId, collectionDate: new Date() } as never, ctx);
  await saveSamples(actor, id, [
    { sampleNumber: 0, timeMinutes: 0, h2Ppm: 4, ch4Ppm: 2 },
    { sampleNumber: 1, timeMinutes: 30, h2Ppm: 30, ch4Ppm: 3 },
  ] as never, ctx);
  await completeSampleCollection(actor, id, ctx);
  return id;
}

async function main() {
  console.log("=== Patient portal & hospital isolation tests ===\n");
  const s = Date.now().toString().slice(-7);

  const admin = await asUser("admin@specter.health");
  const support = await asUser("support@specter.health");
  const nurseA = await asUser("nurse@specter.health");
  const physicianA = await asUser("physician@specter.health");
  const hospitalA = await prisma.hospital.findUniqueOrThrow({ where: { id: nurseA.hospitalId! } });
  const sibo = await prisma.testType.findUniqueOrThrow({ where: { key: "SIBO_GLUCOSE" } });

  const { id: hospitalBId } = await createHospital(admin, { name: `Isolation Hospital ${s}`, code: `ISO-${s}`, city: "Abu Dhabi" }, ctx);
  const { id: deptBId } = await addDepartment(admin, hospitalBId, "Gastro B", ctx);
  await createUser(admin, { email: `nurse.b.${s}@test.local`, name: "Nurse B", role: "NURSE", password: "Passw0rd!", hospitalId: hospitalBId }, ctx);
  await createUser(admin, { email: `phys.b.${s}@test.local`, name: "Physician B", role: "PHYSICIAN", password: "Passw0rd!", hospitalId: hospitalBId }, ctx);
  const nurseB = await asUser(`nurse.b.${s}@test.local`);
  const physicianB = await asUser(`phys.b.${s}@test.local`);

  const mk = (mrn: string, name: string, hospitalId: string, who: CurrentUser) =>
    createPatient(who, { mrn, name, dob: "1985-06-01", gender: "FEMALE", hospitalId }, ctx);
  const { id: p1 } = await mk(`P1-${s}`, "Portal Patient One", hospitalA.id, nurseA);
  const { id: p2 } = await mk(`P2-${s}`, "Portal Patient Two", hospitalA.id, nurseA);
  const { id: p3 } = await mk(`P3-${s}`, "Portal Patient Three", hospitalBId, nurseB);

  const t1 = await finalizedTest(nurseA, p1, sibo.id);
  const { id: t1draft } = await createTest(nurseA, { patientId: p1, testTypeId: sibo.id } as never, ctx);
  const t2 = await finalizedTest(nurseA, p2, sibo.id);
  const t3 = await finalizedTest(nurseB, p3, sibo.id);

  // ---------------------------------------------------------------------------
  console.log("[1] Hospital isolation — staff (Nurse/Physician of hospital B vs A)");
  check("nurse B cannot open hospital A patient", (await getPatient(nurseB, p1, ctx)) === null);
  check("nurse B cannot open hospital A test", (await getTestDetail(nurseB, t1, ctx)) === null);
  check("physician B cannot open hospital A test", (await getTestDetail(physicianB, t1, ctx)) === null);
  check("nurse A cannot open hospital B test", (await getTestDetail(nurseA, t3, ctx)) === null);
  const pageB = await listPatientsPage(nurseB, {});
  check("nurse B patient list has only hospital B", pageB.rows.every((r) => r.hospitalName === `Isolation Hospital ${s}`) && pageB.rows.some((r) => r.id === p3));
  const searchB = await listPatientsPage(nurseB, { q: "Portal Patient" });
  check("nurse B search cannot surface hospital A names", searchB.rows.every((r) => r.id === p3), JSON.stringify(searchB.rows.map((r) => r.id)));
  const testsB = await listTestsPage(nurseB, { q: `P1-${s}` });
  check("nurse B test search by hospital-A MRN returns nothing", testsB.total === 0);
  check("nurse B CSV export excludes hospital A", !(await listTestsForExport(nurseB)).some((t) => t.id === t1 || t.id === t2));
  await expectThrow("physician B cannot write diagnosis on hospital A test", () => saveDiagnosis(physicianB, t1draft, { diagnosis: "x" }, ctx), "Test not found");
  await expectThrow("physician B cannot read hospital A audit trail", () => getTestAuditTrail(physicianB, t1), "Test not found");
  await expectThrow("nurse B cannot register a patient into hospital A",
    () => mk(`X-${s}`, "Injected", hospitalA.id, nurseB), "own hospital");
  await expectThrow("nurse B cannot create a test for hospital A patient",
    () => createTest(nurseB, { patientId: p1, testTypeId: sibo.id } as never, ctx), "does not exist");
  await expectThrow("createTest rejects another hospital's department",
    () => createTest(nurseA, { patientId: p1, testTypeId: sibo.id, departmentId: deptBId } as never, ctx), "department");
  await expectThrow("createTest rejects another hospital's technician",
    () => createTest(nurseA, { patientId: p1, testTypeId: sibo.id, technicianId: nurseB.id } as never, ctx), "technician");
  await expectThrow("createTest rejects an unknown test type",
    () => createTest(nurseA, { patientId: p1, testTypeId: "nope" } as never, ctx), "test type");
  check("admin is cross-hospital (sees B test)", (await getTestDetail(admin, t3, ctx)) !== null);
  check("same-hospital physician A sees A test", (await getTestDetail(physicianA, t1, ctx)) !== null);

  console.log("\n[2] Scoping helpers fail closed");
  check("unknown/missing role is hospital-scoped", isHospitalScoped(undefined) && isHospitalScoped(null) && isHospitalScoped("PATIENT" as never));
  check("ADMIN / SUPPORT unscoped", !isHospitalScoped("ADMIN") && !isHospitalScoped("SPECTER_SUPPORT"));
  const orphan: CurrentUser = { ...nurseA, hospitalId: null };
  check("scoped user without hospital matches nothing", hospitalScope(orphan).hospitalId === "__no_hospital_assigned__");
  check("scoped user without hospital is outside every record", isOutsideScope(orphan, hospitalA.id) && isOutsideScope(orphan, null));
  const patientSession = { user: { id: "acc", kind: "patient", patientId: p1, hospitalId: hospitalA.id }, expires: "" } as Session;
  const staffSession = { user: { id: nurseA.id, kind: "staff", role: "NURSE", hospitalId: hospitalA.id }, expires: "" } as Session;
  check("patient session is never a staff actor", staffFromSession(patientSession) === null);
  check("staff session is never a patient", patientFromSession(staffSession) === null);
  check("roleless staff-kind session rejected", staffFromSession({ user: { id: "x", kind: "staff", hospitalId: null }, expires: "" } as Session) === null);
  check("SPECTER_SUPPORT cannot manage portal", !can("SPECTER_SUPPORT", "portal:manage"));

  console.log("\n[3] Portal access issuance is scoped + permissioned");
  await expectThrow("nurse B cannot issue portal access for hospital A patient", () => issuePortalAccess(nurseB, p1, ctx), "Patient not found");
  await expectThrow("nurse B cannot read hospital A portal status", () => getPortalAccess(nurseB, p1), "Patient not found");
  await expectThrow("support cannot issue portal access", () => issuePortalAccess(support, p1, ctx), "Forbidden");
  const issued = await issuePortalAccess(nurseA, p1, ctx);
  check("temp password generated (XXXX-XXXX-XXXX)", /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/.test(issued.tempPassword), issued.tempPassword);
  check("temp passwords are random", generateTempPassword() !== generateTempPassword());
  const stored = await prisma.patientAccount.findUniqueOrThrow({ where: { patientId: p1 } });
  check("password stored only as bcrypt hash", stored.passwordHash.startsWith("$2") && !stored.passwordHash.includes(issued.tempPassword));
  check("status shows enabled + must change", (await getPortalAccess(nurseA, p1)).enabled && stored.mustChangePassword);
  check("audit has no plaintext password", !(await prisma.auditLog.findMany({ where: { entity: "PatientAccount" } })).some((a) => JSON.stringify(a).includes(issued.tempPassword)));

  console.log("\n[4] Patient sign-in");
  check("wrong password rejected", (await verifyPatientCredentials(`P1-${s}`, "wrong-pass1", ctx)) === null);
  check("patient without portal access rejected", (await verifyPatientCredentials(`P2-${s}`, issued.tempPassword, ctx)) === null);
  check("unknown MRN rejected", (await verifyPatientCredentials(`NOPE-${s}`, issued.tempPassword, ctx)) === null);
  const who = await verifyPatientCredentials(`p1-${s}`.toUpperCase(), issued.tempPassword, ctx);
  check("correct MRN + temp password accepted", who?.kind === "patient" && who.patientId === p1);
  check("token identity carries no patient name (no PHI in JWT)", !!who && !JSON.stringify(who).includes("Portal Patient"));

  console.log("\n[5] Patient sees ONLY their own finalized reports");
  const me = { accountId: stored.id, patientId: p1, hospitalId: hospitalA.id };
  const mine = await listOwnReports(me);
  check("lists own finalized report", mine.some((r) => r.id === t1));
  check("does not list own unfinalized (draft) report", !mine.some((r) => r.id === t1draft));
  check("does not list another patient's report (same hospital)", !mine.some((r) => r.id === t2));
  check("does not list another hospital's report", !mine.some((r) => r.id === t3));
  check("loads own finalized report", (await loadOwnReport(me, t1, ctx))?.patient.name === "Portal Patient One");
  check("cannot load same-hospital other patient's report", (await loadOwnReport(me, t2, ctx)) === null);
  check("cannot load other hospital's report", (await loadOwnReport(me, t3, ctx)) === null);
  check("cannot load own draft report", (await loadOwnReport(me, t1draft, ctx)) === null);
  check("cannot load nonexistent id", (await loadOwnReport(me, "does-not-exist", ctx)) === null);
  check("profile is own", (await getOwnProfile(me))?.mrn === `P1-${s}`);

  console.log("\n[6] Password change");
  await expectThrow("wrong current password", () => changeOwnPassword(me, "nope", "NewPass123", ctx), "incorrect");
  await expectThrow("too short", () => changeOwnPassword(me, issued.tempPassword, "a1", ctx), "8 characters");
  await expectThrow("needs letter + number", () => changeOwnPassword(me, issued.tempPassword, "abcdefghij", ctx), "letter and one number");
  await expectThrow("cannot contain MRN", () => changeOwnPassword(me, issued.tempPassword, `x${s}P1-${s}9`, ctx), "MRN");
  await changeOwnPassword(me, issued.tempPassword, "MyOwnPass42", ctx);
  check("mustChangePassword cleared", !(await prisma.patientAccount.findUniqueOrThrow({ where: { id: stored.id } })).mustChangePassword);
  check("old temp password no longer works", (await verifyPatientCredentials(`P1-${s}`, issued.tempPassword, ctx)) === null);
  const relog = await verifyPatientCredentials(`P1-${s}`, "MyOwnPass42", ctx);
  check("new password works", relog?.patientId === p1);

  console.log("\n[7] Session revocation");
  const tok = { kind: "patient", uid: stored.id, sv: relog!.sessionVersion };
  check("valid patient session revalidates", (await revalidateSession(tok))?.kind === "patient");
  const reissue = await issuePortalAccess(nurseA, p1, ctx);
  check("staff reset revokes existing patient sessions", (await revalidateSession(tok)) === null);
  const after = await verifyPatientCredentials(`P1-${s}`, reissue.tempPassword, ctx);
  await disablePortalAccess(nurseA, p1, ctx);
  check("disable revokes the patient session", (await revalidateSession({ kind: "patient", uid: stored.id, sv: after!.sessionVersion })) === null);
  check("disabled account cannot sign in", (await verifyPatientCredentials(`P1-${s}`, reissue.tempPassword, ctx)) === null);
  await expectThrow("nurse B cannot disable hospital A portal", () => disablePortalAccess(nurseB, p1, ctx), "Patient not found");

  console.log("\n[8] Brute-force lockout (patient)");
  const lockIssue = await issuePortalAccess(nurseA, p2, ctx);
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await verifyPatientCredentials(`P2-${s}`, `bad-${i}`, ctx).catch(() => null);
  await expectThrow("locked after repeated failures — even the right password", () => verifyPatientCredentials(`P2-${s}`, lockIssue.tempPassword, ctx), "locked");
  check("lock visible to staff", !!(await getPortalAccess(nurseA, p2)).lockedUntil);
  const unlock = await issuePortalAccess(nurseA, p2, ctx);
  check("staff reset unlocks", (await verifyPatientCredentials(`P2-${s}`, unlock.tempPassword, ctx))?.patientId === p2);

  console.log("\n[9] Staff sign-in hardening");
  const email = `lock.${s}@test.local`;
  await createUser(admin, { email, name: "Lock Test", role: "NURSE", password: "Passw0rd!", hospitalId: hospitalA.id }, ctx);
  const staff = await verifyStaffCredentials(email, "Passw0rd!", ctx);
  check("staff sign-in works", staff?.kind === "staff" && staff.role === "NURSE");
  const staffTok = { kind: "staff", uid: staff!.id, sv: staff!.sessionVersion };
  check("staff session revalidates", (await revalidateSession(staffTok))?.kind === "staff");
  await resetUserPassword(admin, staff!.id, { password: "N3wPassw0rd!" }, ctx);
  check("admin password reset revokes sessions", (await revalidateSession(staffTok)) === null);
  const staff2 = await verifyStaffCredentials(email, "N3wPassw0rd!", ctx);
  await setUserActive(admin, staff2!.id, false, ctx);
  check("deactivation revokes sessions immediately", (await revalidateSession({ kind: "staff", uid: staff2!.id, sv: staff2!.sessionVersion })) === null);
  check("deactivated user cannot sign in", (await verifyStaffCredentials(email, "N3wPassw0rd!", ctx)) === null);
  await setUserActive(admin, staff2!.id, true, ctx);
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await verifyStaffCredentials(email, `bad-${i}`, ctx).catch(() => null);
  let lockedErr = false;
  try { await verifyStaffCredentials(email, "N3wPassw0rd!", ctx); } catch (e) { lockedErr = e instanceof AccountLockedError; }
  check("staff locked after repeated failures", lockedErr);
  check("unknown staff email rejected", (await verifyStaffCredentials(`ghost.${s}@test.local`, "x", ctx)) === null);
  check("patient token cannot revalidate as staff", (await revalidateSession({ kind: "staff", uid: stored.id, sv: 0 })) === null);
  check("staff token cannot revalidate as patient", (await revalidateSession({ kind: "patient", uid: nurseA.id, sv: 0 })) === null);

  console.log("\n[10] Redirect safety");
  check("relative path kept", safeCallbackUrl("/tests?status=DRAFT") === "/tests?status=DRAFT");
  check("absolute URL rejected", safeCallbackUrl("https://evil.example/") === "/");
  check("protocol-relative rejected", safeCallbackUrl("//evil.example") === "/");
  check("backslash trick rejected", safeCallbackUrl("/\\evil.example") === "/");
  check("javascript: rejected", safeCallbackUrl("javascript:alert(1)") === "/");

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await prisma.$disconnect();
  process.exit(1);
});
