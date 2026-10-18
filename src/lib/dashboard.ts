import type { ReportStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { can } from "./rbac";
import { hospitalScope, type CurrentUser } from "./session";

// -----------------------------------------------------------------------------
// Dashboard summary. Counts respect hospital scoping exactly like the list
// pages; sections the actor has no permission for come back null.
// -----------------------------------------------------------------------------

export interface DashboardStats {
  patients: number | null;
  tests: { total: number; byStatus: Record<ReportStatus, number>; lastWeek: number } | null;
  recentTests: Array<{
    id: string;
    patientName: string;
    patientMrn: string;
    testTypeName: string;
    status: ReportStatus;
    createdAt: Date;
  }>;
  admin: { hospitals: number; activeUsers: number } | null;
}

export async function getDashboardStats(actor: CurrentUser): Promise<DashboardStats> {
  const scope = hospitalScope(actor);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const canPatients = can(actor.role, "patient:read");
  const canTests = can(actor.role, "test:read");
  const canAdmin = can(actor.role, "user:manage");

  const [patients, grouped, lastWeek, recent, hospitals, activeUsers] = await Promise.all([
    canPatients ? prisma.patient.count({ where: scope }) : Promise.resolve(null),
    canTests
      ? prisma.breathTest.groupBy({ by: ["status"], where: { patient: scope }, _count: { _all: true } })
      : Promise.resolve(null),
    canTests
      ? prisma.breathTest.count({ where: { patient: scope, createdAt: { gte: weekAgo } } })
      : Promise.resolve(0),
    canTests
      ? prisma.breathTest.findMany({
          where: { patient: scope },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            status: true,
            createdAt: true,
            patient: { select: { mrn: true, nameEnc: true } },
            testType: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    canAdmin ? prisma.hospital.count() : Promise.resolve(0),
    canAdmin ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(0),
  ]);

  let tests: DashboardStats["tests"] = null;
  if (grouped) {
    const byStatus: Record<ReportStatus, number> = { DRAFT: 0, IN_PROGRESS: 0, FINALIZED: 0 };
    for (const g of grouped) byStatus[g.status] = g._count._all;
    tests = { total: byStatus.DRAFT + byStatus.IN_PROGRESS + byStatus.FINALIZED, byStatus, lastWeek };
  }

  return {
    patients,
    tests,
    recentTests: recent.map((t) => ({
      id: t.id,
      patientName: decrypt(t.patient.nameEnc) ?? "—",
      patientMrn: t.patient.mrn,
      testTypeName: t.testType.name,
      status: t.status,
      createdAt: t.createdAt,
    })),
    admin: canAdmin ? { hospitals, activeUsers } : null,
  };
}
