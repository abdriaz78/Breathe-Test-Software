import { z } from "zod";
import { prisma } from "./prisma";
import { recordAudit } from "./audit";
import { authorize, type CurrentUser } from "./session";

// -----------------------------------------------------------------------------
// Admin: test-type catalog. Manage the four built-ins + custom types, and edit
// interpretation-support thresholds. Permission: testtype:manage (ADMIN, Support).
// Thresholds drive SUPPORT FLAGS ONLY — never an automatic diagnosis.
// -----------------------------------------------------------------------------

const optThreshold = z
  .union([z.coerce.number().positive(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? undefined : Number(v)));

export const testTypeSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  defaultSubstrate: z.string().trim().max(200).optional().or(z.literal("")),
  defaultDose: z.string().trim().max(200).optional().or(z.literal("")),
  h2RiseFromBaselinePpm: optThreshold,
  ch4AbsolutePpm: optThreshold,
  combinedRiseFromBaselinePpm: optThreshold,
});
export type TestTypeInput = z.infer<typeof testTypeSchema>;

type Ctx = { ipAddress: string | null; userAgent: string | null };

function rulesFrom(data: TestTypeInput) {
  const rules: Record<string, number> = {};
  if (data.h2RiseFromBaselinePpm != null) rules.h2RiseFromBaselinePpm = data.h2RiseFromBaselinePpm;
  if (data.ch4AbsolutePpm != null) rules.ch4AbsolutePpm = data.ch4AbsolutePpm;
  if (data.combinedRiseFromBaselinePpm != null) rules.combinedRiseFromBaselinePpm = data.combinedRiseFromBaselinePpm;
  return Object.keys(rules).length ? rules : undefined;
}

/** Derive a stable machine key from a name, e.g. "SIBO Glucose" -> "SIBO_GLUCOSE". */
function keyFromName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function listTestTypes(actor: CurrentUser) {
  authorize(actor.role, "testtype:manage");
  return prisma.testType.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export async function createTestType(actor: CurrentUser, raw: TestTypeInput, ctx: Ctx) {
  authorize(actor.role, "testtype:manage");
  const data = testTypeSchema.parse(raw);

  let key = keyFromName(data.name) || "CUSTOM";
  // Ensure key uniqueness by suffixing if needed.
  const base = key;
  let n = 1;
  while (await prisma.testType.findUnique({ where: { key } })) {
    key = `${base}_${++n}`;
  }

  const tt = await prisma.testType.create({
    data: {
      key,
      name: data.name,
      defaultSubstrate: data.defaultSubstrate || null,
      defaultDose: data.defaultDose || null,
      interpretationRules: rulesFrom(data),
      isSystem: false,
    },
  });
  await recordAudit({
    action: "CREATE", entity: "TestType", entityId: tt.id,
    actorId: actor.id, actorRole: actor.role,
    summary: `Created custom test type "${data.name}"`, ...ctx,
  });
  return { id: tt.id };
}

export async function updateTestType(actor: CurrentUser, id: string, raw: TestTypeInput, ctx: Ctx) {
  authorize(actor.role, "testtype:manage");
  const data = testTypeSchema.parse(raw);
  await prisma.testType.update({
    where: { id },
    data: {
      name: data.name,
      defaultSubstrate: data.defaultSubstrate || null,
      defaultDose: data.defaultDose || null,
      interpretationRules: rulesFrom(data) ?? undefined,
    },
  });
  await recordAudit({
    action: "UPDATE", entity: "TestType", entityId: id,
    actorId: actor.id, actorRole: actor.role,
    summary: `Updated test type "${data.name}"`, ...ctx,
  });
}

export async function setTestTypeActive(actor: CurrentUser, id: string, active: boolean, ctx: Ctx) {
  authorize(actor.role, "testtype:manage");
  const tt = await prisma.testType.update({
    where: { id }, data: { isActive: active }, select: { name: true },
  });
  await recordAudit({
    action: "UPDATE", entity: "TestType", entityId: id,
    actorId: actor.id, actorRole: actor.role,
    summary: `${active ? "Enabled" : "Disabled"} test type "${tt.name}"`, ...ctx,
  });
}
