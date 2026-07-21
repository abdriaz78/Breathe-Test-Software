import type { ReportStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import {
  computeInterpretation,
  summarizeResult,
  type InterpretationResult,
  type InterpretationRules,
  type ResultSummary,
} from "./interpretation";

// -----------------------------------------------------------------------------
// Assembles everything the PDF report needs: decrypted patient/test data, the
// full sample series, and interpretation-support flags. This loader does NOT
// audit — the caller records a single EXPORT event so we don't double-log.
// -----------------------------------------------------------------------------

export interface ReportSample {
  sampleNumber: number;
  timeMinutes: number;
  h2Ppm: number | null;
  ch4Ppm: number | null;
  co2Percent: number | null;
  correctionFactor: number | null;
  symptoms: string | null;
  skipped: boolean;
  skippedReason: string | null;
}

export interface ReportData {
  id: string;
  status: ReportStatus;
  hospitalName: string;
  hospitalCity: string | null;
  hospitalLogoUrl: string | null;
  departmentName: string | null;
  patient: {
    mrn: string;
    name: string;
    dob: string;
    gender: string;
    weightKg: number | null;
    referringPhysician: string | null;
  };
  test: {
    typeName: string;
    substrate: string | null;
    dose: string | null;
    collectionDate: Date | null;
    analysisDate: Date | null;
    preTestSymptoms: string | null;
    preTestNotes: string | null;
    technicianName: string | null;
  };
  samples: ReportSample[];
  /** Plain-language description of substrate/dose, e.g. "Patient received as
   * the test substrate 75 g glucose in 250 mL water. Breath was collected at
   * specified time intervals." Omitted when neither field is set. */
  methodText: string | null;
  /** Unique, non-empty symptoms reported across samples during collection —
   * distinct from preTestSymptoms, which are recorded before the test starts. */
  symptomsDuringTest: string | null;
  interpretation: InterpretationResult;
  resultSummary: ResultSummary | null;
  /** H2 rise-from-baseline threshold (ppm) for the chart's red trigger line. */
  h2RiseThreshold: number | null;
  diagnosis: string | null;
  recommendation: string | null;
  signature: {
    name: string | null;
    /** e.g. "Dr." — used for the title line under the investigator's name. */
    title: string | null;
    /** Free-text credentials/license, e.g. "MBBS, MSc Gastroenterology". */
    licenseNo: string | null;
    signedAt: Date | null;
    finalizedAt: Date | null;
  };
  generatedAt: Date;
}

export async function loadReportData(id: string): Promise<ReportData | null> {
  const t = await prisma.breathTest.findUnique({
    where: { id },
    include: {
      patient: {
        include: { hospital: { select: { name: true, city: true, logoUrl: true } } },
      },
      testType: { select: { name: true, interpretationRules: true } },
      department: { select: { name: true } },
      technician: { select: { name: true, title: true } },
      signedBy: { select: { name: true, title: true, licenseNo: true } },
      samples: { orderBy: { sampleNumber: "asc" } },
    },
  });
  if (!t) return null;

  const samples: ReportSample[] = t.samples.map((s) => ({
    sampleNumber: s.sampleNumber,
    timeMinutes: s.timeMinutes,
    h2Ppm: s.h2Ppm != null ? Number(s.h2Ppm) : null,
    ch4Ppm: s.ch4Ppm != null ? Number(s.ch4Ppm) : null,
    co2Percent: s.co2Percent != null ? Number(s.co2Percent) : null,
    correctionFactor: s.correctionFactor != null ? Number(s.correctionFactor) : null,
    symptoms: s.symptoms,
    skipped: s.skipped,
    skippedReason: s.skippedReason,
  }));

  const rules = (t.testType.interpretationRules as InterpretationRules | null) ?? null;
  const interpretation = computeInterpretation(
    samples.map((s) => ({
      timeMinutes: s.timeMinutes,
      h2Ppm: s.h2Ppm,
      ch4Ppm: s.ch4Ppm,
      skipped: s.skipped,
    })),
    rules
  );
  const resultSummary = summarizeResult(
    samples.map((s) => ({
      timeMinutes: s.timeMinutes,
      h2Ppm: s.h2Ppm,
      ch4Ppm: s.ch4Ppm,
      skipped: s.skipped,
    })),
    rules
  );

  const methodText = t.dose
    ? `Patient received as the test substrate ${t.dose}. Breath was collected after specified time intervals.`
    : t.substrate
      ? `Patient received ${t.substrate} as the test substrate. Breath was collected after specified time intervals.`
      : null;

  const symptomsDuringTest =
    Array.from(
      new Set(
        samples
          .filter((s) => !s.skipped && s.symptoms)
          .map((s) => s.symptoms!.trim())
          .filter(Boolean)
      )
    ).join(", ") || null;

  const techName = t.technician
    ? `${t.technician.title ? t.technician.title + " " : ""}${t.technician.name}`
    : null;
  const signName = t.signatureName
    ? t.signatureName
    : t.signedBy
      ? `${t.signedBy.title ? t.signedBy.title + " " : ""}${t.signedBy.name}`
      : null;

  return {
    id: t.id,
    status: t.status,
    hospitalName: t.patient.hospital.name,
    hospitalCity: t.patient.hospital.city,
    hospitalLogoUrl: t.patient.hospital.logoUrl,
    departmentName: t.department?.name ?? null,
    patient: {
      mrn: t.patient.mrn,
      name: decrypt(t.patient.nameEnc) ?? "—",
      dob: decrypt(t.patient.dobEnc) ?? "",
      gender: t.patient.gender,
      weightKg: t.patient.weightKg ? Number(t.patient.weightKg) : null,
      referringPhysician: decrypt(t.patient.referringPhysicianEnc),
    },
    test: {
      typeName: t.testType.name,
      substrate: t.substrate,
      dose: t.dose,
      collectionDate: t.collectionDate,
      analysisDate: t.analysisDate,
      preTestSymptoms: t.preTestSymptoms,
      preTestNotes: t.preTestNotes,
      technicianName: techName,
    },
    samples,
    methodText,
    symptomsDuringTest,
    interpretation,
    resultSummary,
    h2RiseThreshold: rules?.h2RiseFromBaselinePpm ?? null,
    diagnosis: t.diagnosis,
    recommendation: t.recommendation,
    signature: {
      name: signName,
      title: t.signedBy?.title ?? null,
      licenseNo: t.signedBy?.licenseNo ?? null,
      signedAt: t.signedAt,
      finalizedAt: t.finalizedAt,
    },
    generatedAt: new Date(),
  };
}
