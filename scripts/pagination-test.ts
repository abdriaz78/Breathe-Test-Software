import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first"); // match the app's IPv4-first fix

import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { createPatient, listPatientsPage } from "@/lib/patients";
import { createTest, listTestsPage, countTestsByStatus } from "@/lib/tests";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";

// Covers paged + searchable patient and test lists. Every record this script
// creates is tagged with the run stamp and removed at the end.

const UA = "pagination-test";
const ctx = { ipAddress: "127.0.0.1", userAgent: UA };
let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " -> " + detail : ""}`); }
}
async function asUser(email: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, hospitalId: u.hospitalId };
}

const created = { hospitals: [] as string[], patients: [] as string[], tests: [] as string[], users: [] as string[] };

async function walkAll<T extends { id: string }>(fetch: (page: number) => Promise<{ rows: T[]; pageCount: number; total: number }>) {
  const first = await fetch(1);
  const ids: string[] = [...first.rows.map((r) => r.id)];
  for (let p = 2; p <= first.pageCount; p++) ids.push(...(await fetch(p)).rows.map((r) => r.id));
  return { ids, total: first.total, pageCount: first.pageCount };
}

async function main() {
  console.log("=== Paged + searchable lists ===\n");
  const admin = await asUser("admin@specter.health");
  const nurse = await asUser("nurse@specter.health");
  const stamp = Date.now().toString().slice(-7);

  console.log("[1] Page parsing");
  check("parsePage: valid numbers", parsePage("3") === 3 && parsePage("1") === 1);
  check("parsePage: junk falls back to page 1", [undefined, "", "0", "-2", "abc", "1.5"].every((v) => parsePage(v) === 1));

  console.log("\n[2] Patients: every record reachable");
  const scopeTotal = await prisma.patient.count();
  const allP = await walkAll((p) => listPatientsPage(admin, { page: p }));
  check(`admin total matches database (${scopeTotal})`, allP.total === scopeTotal, `${allP.total}`);
  check("pages cover every patient", allP.ids.length === scopeTotal, `${allP.ids.length}`);
  check("no patient appears twice", new Set(allP.ids).size === allP.ids.length);
  check(`page size is ${PAGE_SIZE}`, (await listPatientsPage(admin, { page: 1 })).rows.length === Math.min(PAGE_SIZE, scopeTotal));
  check("old 200-row limit is gone", scopeTotal <= 200 || allP.ids.length > 200);
  const last = await listPatientsPage(admin, { page: 9999 });
  check("page past the end is clamped to the last page", last.page === last.pageCount && last.rows.length > 0);

  console.log("\n[3] Patients: search covers all records + respects hospital scope");
  const other = await prisma.hospital.create({ data: { name: `ZZPAGE Other ${stamp}` } });
  created.hospitals.push(other.id);
  const otherNurse = await prisma.user.create({
    data: { email: `zzpage-${stamp}@example.invalid`, name: "ZZ Page Nurse", passwordHash: "x", role: "NURSE", hospitalId: other.id },
  });
  created.users.push(otherNurse.id);
  const on: CurrentUser = { id: otherNurse.id, name: otherNurse.name, email: otherNurse.email, role: "NURSE", hospitalId: other.id };

  const { id: pid } = await createPatient(nurse, {
    mrn: `ZZPG-${stamp}`, name: `Quokka Fernsby ${stamp}`, dob: "1980-02-02", gender: "FEMALE", hospitalId: nurse.hospitalId!,
  }, ctx);
  created.patients.push(pid);

  const byName = await listPatientsPage(nurse, { q: "quokka fern" });
  check("search by part of the (encrypted) name, any case", byName.rows.some((r) => r.id === pid), JSON.stringify(byName.total));
  check("search by part of the MRN", (await listPatientsPage(nurse, { q: `zzpg-${stamp}` })).rows.some((r) => r.id === pid));
  check("search total counts matches only", byName.total >= 1 && byName.rows.length === Math.min(byName.total, PAGE_SIZE));
  check("other-hospital nurse cannot find it", !(await listPatientsPage(on, { q: "quokka" })).rows.some((r) => r.id === pid));
  check("other-hospital nurse sees only their hospital", (await listPatientsPage(on, {})).total === 0);
  check("no-match search returns an empty page", (await listPatientsPage(nurse, { q: `nomatch-${stamp}-xyz` })).total === 0);

  // The very oldest patient (beyond any old 200 cap) must be findable by search.
  const oldest = await prisma.patient.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, mrn: true } });
  if (oldest) {
    check("oldest patient is findable by MRN search", (await listPatientsPage(admin, { q: oldest.mrn })).rows.some((r) => r.id === oldest.id));
  }

  console.log("\n[4] Tests: pages, status filter and search");
  const counts = await countTestsByStatus(admin);
  const allT = await walkAll((p) => listTestsPage(admin, { page: p }));
  const sum = counts.DRAFT + counts.IN_PROGRESS + counts.FINALIZED;
  check(`all tests reachable (${sum})`, allT.ids.length === sum && new Set(allT.ids).size === sum, `${allT.ids.length}`);
  for (const s of ["DRAFT", "IN_PROGRESS", "FINALIZED"] as const) {
    const r = await walkAll((p) => listTestsPage(admin, { status: s, page: p }));
    check(`status ${s}: total ${counts[s]} and all pages consistent`, r.total === counts[s] && r.ids.length === counts[s]);
  }
  const sibo = await prisma.testType.findUniqueOrThrow({ where: { key: "SIBO_GLUCOSE" } });
  const { id: tid } = await createTest(nurse, { patientId: pid, testTypeId: sibo.id }, ctx);
  created.tests.push(tid);
  check("test search by patient name", (await listTestsPage(nurse, { q: "QUOKKA" })).rows.some((r) => r.id === tid));
  check("test search + status filter combine", (await listTestsPage(nurse, { q: "quokka", status: "DRAFT" })).rows.some((r) => r.id === tid)
    && !(await listTestsPage(nurse, { q: "quokka", status: "FINALIZED" })).rows.some((r) => r.id === tid));
  check("other-hospital nurse cannot find the test", !(await listTestsPage(on, { q: "quokka" })).rows.some((r) => r.id === tid));
}

async function cleanup() {
  const ids = [...created.hospitals, ...created.patients, ...created.tests, ...created.users];
  await prisma.auditLog.deleteMany({ where: { OR: [{ breathTestId: { in: created.tests } }, { entityId: { in: ids } }, { userAgent: UA }] } });
  await prisma.breathTest.deleteMany({ where: { id: { in: created.tests } } });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  console.log(`\nCleanup done (leftover ZZPAGE hospitals: ${await prisma.hospital.count({ where: { name: { startsWith: "ZZPAGE" } } })}).`);
}

main()
  .catch((e) => { fail++; console.error("FATAL", e); })
  .finally(async () => {
    try { await cleanup(); } catch (e) { console.error("CLEANUP FAILED", e); fail++; }
    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
    await prisma.$disconnect();
    process.exit(fail ? 1 : 0);
  });
