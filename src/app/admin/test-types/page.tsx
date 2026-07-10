import { requirePermission } from "@/lib/session";
import { listTestTypes } from "@/lib/admin-testtypes";
import { AppShell } from "@/components/AppShell";
import { TestTypesAdmin, type AdminTestType } from "@/components/admin/TestTypesAdmin";

interface RulesShape {
  h2RiseFromBaselinePpm?: number;
  ch4AbsolutePpm?: number;
  combinedRiseFromBaselinePpm?: number;
}

export default async function TestTypesAdminPage() {
  const user = await requirePermission("testtype:manage");
  const types = await listTestTypes(user);

  const rows: AdminTestType[] = types.map((t) => {
    const r = (t.interpretationRules as RulesShape | null) ?? {};
    return {
      id: t.id, key: t.key, name: t.name,
      defaultSubstrate: t.defaultSubstrate, defaultDose: t.defaultDose,
      isSystem: t.isSystem, isActive: t.isActive,
      h2RiseFromBaselinePpm: r.h2RiseFromBaselinePpm,
      ch4AbsolutePpm: r.ch4AbsolutePpm,
      combinedRiseFromBaselinePpm: r.combinedRiseFromBaselinePpm,
    };
  });

  return (
    <AppShell user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Test Types" }]}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Test-type catalog</h1>
      <p className="mb-6 text-sm text-slate-500">
        Manage built-in and custom test types. Thresholds drive interpretation-support
        flags only — they never produce an automatic diagnosis.
      </p>
      <TestTypesAdmin testTypes={rows} />
    </AppShell>
  );
}
