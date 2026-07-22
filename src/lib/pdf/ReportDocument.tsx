import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "@/lib/report";
import { sampleTotal } from "@/lib/sample-math";
import { CH4_TRIGGER_PPM } from "@/lib/chart-geometry";
import { ReportChart } from "./ReportChart";

// -----------------------------------------------------------------------------
// The professional PDF report. Structure mirrors the clinical requirement:
// branding, patient + test details, chart, sample table, notes, interpretation
// SUPPORT (explicitly not a diagnosis), physician diagnosis/recommendation box,
// signature, and date. Uses standard PDF fonts (Helvetica) + ASCII gas labels.
// -----------------------------------------------------------------------------

const BRAND = "#0f766e";
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

const s = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 40, paddingHorizontal: 40, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 6 },
  brandBox: { flexDirection: "row", alignItems: "center" },
  brandMark: { width: 20, height: 20, borderRadius: 4, backgroundColor: BRAND, color: "#fff", fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 3, marginRight: 7 },
  brandName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK },
  brandSub: { fontSize: 7.5, color: MUTED },
  hospRight: { textAlign: "right", alignItems: "flex-end", maxWidth: 300 },
  hospLogo: { height: 44, maxWidth: 240, objectFit: "contain", marginBottom: 4 },
  hospName: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  hospSub: { fontSize: 7.5, color: MUTED },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 1 },
  statusPill: { alignSelf: "flex-start", marginTop: 2, marginBottom: 3, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6, marginBottom: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", marginBottom: 2, paddingRight: 10 },
  cellThird: { width: "33.33%", marginBottom: 2, paddingRight: 10 },
  fieldLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase" },
  fieldValue: { fontSize: 9, marginTop: 1 },
  // table
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 3, marginTop: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  trLast: { flexDirection: "row" },
  th: { backgroundColor: "#f1f5f9", fontFamily: "Helvetica-Bold", fontSize: 7, padding: 2 },
  td: { padding: 2, fontSize: 7.5 },
  cNum: { width: "8%" },
  cTime: { width: "12%" },
  cVal: { width: "12%", textAlign: "right" },
  cSym: { width: "32%" },
  skippedText: { color: MUTED, fontStyle: "italic" },
  note: { marginTop: 2, fontSize: 9, lineHeight: 1.3 },
  bulletLine: { flexDirection: "row", marginBottom: 1 },
  bulletMark: { width: 10, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 9, lineHeight: 1.3 },
  chartsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  chartCol: { width: "48%" },
  // Patient identification block, mirrors a standard lab-report header:
  // Patient / DOB / Gender / MRN on the left, Investigation date on the right.
  patientRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  patientLeft: { flexShrink: 1 },
  patientLine: { flexDirection: "row", marginBottom: 1 },
  patientLabel: { width: 90, fontSize: 9, color: MUTED },
  patientValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  investigationDate: { fontSize: 9 },
  resultBox: { marginTop: 2, borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 5, backgroundColor: "#f8fafc" },
  resultVerdict: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  resultStats: { fontSize: 8.5, color: MUTED, marginTop: 3 },
  supportBox: { marginTop: 3, borderWidth: 1, borderColor: "#fcd34d", backgroundColor: "#fffbeb", borderRadius: 3, padding: 5 },
  flagLine: { marginBottom: 2, flexDirection: "row" },
  flagDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#b45309", marginTop: 4, marginRight: 5 },
  disclaimer: { marginTop: 4, fontSize: 7, color: "#92400e", lineHeight: 1.3 },
  dxBox: { marginTop: 4, borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 8, minHeight: 40 },
  dxLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", marginBottom: 2 },
  dxText: { fontSize: 9, lineHeight: 1.3 },
  dxEmpty: { fontSize: 9, color: MUTED, fontStyle: "italic" },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  signBox: { width: "48%" },
  signLine: { borderTopWidth: 1, borderTopColor: INK, marginTop: 16, paddingTop: 3 },
  signLabel: { fontSize: 7, color: MUTED },
  signName: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 18, left: 40, right: 40, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: MUTED },
});

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: "#f1f5f9", color: "#475569", label: "DRAFT — not finalized" },
  IN_PROGRESS: { bg: "#fef3c7", color: "#92400e", label: "IN PROGRESS — not finalized" },
  FINALIZED: { bg: "#d1fae5", color: "#065f46", label: "FINALIZED" },
};

function fmtDate(d: Date | null | string): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmt(v: number | null, digits = 1): string {
  return v == null ? "—" : v.toFixed(digits);
}

function Field({ label, value, third }: { label: string; value: string; third?: boolean }) {
  return (
    <View style={third ? s.cellThird : s.cell}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value || "—"}</Text>
    </View>
  );
}

const GENDER: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other", UNDISCLOSED: "Undisclosed" };

export function ReportDocument({ data }: { data: ReportData }) {
  const pill = STATUS_PILL[data.status];
  const chartSamples = data.samples.map((x) => ({
    sampleNumber: x.sampleNumber,
    timeMinutes: x.timeMinutes,
    h2Ppm: x.h2Ppm,
    ch4Ppm: x.ch4Ppm,
    skipped: x.skipped,
  }));

  return (
    <Document
      title={`Breath Test Report — ${data.patient.mrn}`}
      author="Specter Clinical Platform"
    >
      <Page size="A4" style={s.page}>
        {/* Header / branding */}
        <View style={s.headerRow} fixed>
          <View style={s.brandBox}>
            <Text style={s.brandMark}>S</Text>
            <View>
              <Text style={s.brandName}>Specter</Text>
              <Text style={s.brandSub}>QuinTron Breath Test Platform</Text>
            </View>
          </View>
          <View style={s.hospRight}>
            {data.hospitalLogoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.hospitalLogoUrl} style={s.hospLogo} />
            ) : null}
            <Text style={s.hospName}>{data.hospitalName}</Text>
            <Text style={s.hospSub}>
              {[data.hospitalCity, data.departmentName].filter(Boolean).join(" · ") || "—"}
            </Text>
          </View>
        </View>

        <Text style={s.title}>{(data.test.substrate || data.test.typeName)} Breath Test Report</Text>
        <Text style={[s.statusPill, { backgroundColor: pill.bg, color: pill.color }]}>{pill.label}</Text>

        {/* Patient identification — Patient / DOB / Gender / MRN, with the
            investigation date at top right, mirroring a standard lab printout. */}
        <View style={s.patientRow}>
          <View style={s.patientLeft}>
            <View style={s.patientLine}>
              <Text style={s.patientLabel}>Patient:</Text>
              <Text style={s.patientValue}>{data.patient.name}</Text>
            </View>
            <View style={s.patientLine}>
              <Text style={s.patientLabel}>Date of Birth:</Text>
              <Text style={s.patientValue}>{fmtDate(data.patient.dob)}</Text>
            </View>
            <View style={s.patientLine}>
              <Text style={s.patientLabel}>Gender:</Text>
              <Text style={s.patientValue}>{GENDER[data.patient.gender] ?? data.patient.gender}</Text>
            </View>
            <View style={s.patientLine}>
              <Text style={s.patientLabel}>MRN:</Text>
              <Text style={s.patientValue}>{data.patient.mrn}</Text>
            </View>
          </View>
          <Text style={s.investigationDate}>
            Investigation date: {fmtDate(data.test.collectionDate)}
          </Text>
        </View>

        {/* Test details — supplementary fields not on the reference printout,
            kept so this clinical data isn't dropped from the record. */}
        <Text style={s.sectionTitle}>Test details</Text>
        <View style={s.grid}>
          <Field label="Test type" value={data.test.typeName} third />
          <Field
            label="Substrate / Dose"
            value={[data.test.substrate, data.test.dose].filter(Boolean).join(" — ") || "—"}
            third
          />
          <Field label="Analysis date" value={fmtDate(data.test.analysisDate)} third />
          <Field label="Technician" value={data.test.technicianName ?? "—"} third />
          <Field label="Weight" value={data.patient.weightKg != null ? `${data.patient.weightKg} kg` : "—"} third />
          <Field label="Referring physician" value={data.patient.referringPhysician ?? "—"} third />
        </View>

        {/* Method — plain-language substrate/dose description */}
        {data.methodText && (
          <>
            <Text style={s.sectionTitle}>Method</Text>
            <Text style={s.note}>{data.methodText}</Text>
          </>
        )}

        {/* Test result — compact threshold summary (support, not a diagnosis) */}
        {data.resultSummary && (
          <>
            <Text style={s.sectionTitle}>Test result</Text>
            <View style={s.bulletLine}>
              <Text style={s.bulletMark}>-</Text>
              <Text style={[s.bulletText, { fontFamily: "Helvetica-Bold" }]}>
                {data.resultSummary.verdict}{" "}
                {(data.test.substrate || data.test.typeName).toLowerCase()} breath test result.
              </Text>
            </View>
            <View style={s.bulletLine}>
              <Text style={s.bulletMark}>-</Text>
              <Text style={s.bulletText}>{data.resultSummary.statsLine}</Text>
            </View>
          </>
        )}

        {/* Symptoms reported during sample collection (distinct from pre-test symptoms) */}
        {data.symptomsDuringTest && (
          <>
            <Text style={s.sectionTitle}>Symptoms occurring during investigation</Text>
            <Text style={s.note}>{data.symptomsDuringTest}</Text>
          </>
        )}

        {/* Charts — H2 (baseline + threshold) and CH4 (fixed trigger), side by side */}
        {data.samples.some((x) => !x.skipped) && (
          <View style={s.chartsRow}>
            <View style={s.chartCol}>
              <Text style={s.sectionTitle}>H2 over time</Text>
              <ReportChart
                samples={chartSamples}
                series={["h2"]}
                h2RiseThreshold={data.h2RiseThreshold}
                width={247}
                height={140}
              />
            </View>
            <View style={s.chartCol}>
              <Text style={s.sectionTitle}>CH4 over time</Text>
              <ReportChart
                samples={chartSamples}
                series={["ch4"]}
                ch4Threshold={CH4_TRIGGER_PPM}
                width={247}
                height={140}
              />
            </View>
          </View>
        )}

        {/* Sample table */}
        <Text style={s.sectionTitle}>Samples</Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, s.cNum]}>#</Text>
            <Text style={[s.th, s.cTime]}>Time (min)</Text>
            <Text style={[s.th, s.cVal]}>H2</Text>
            <Text style={[s.th, s.cVal]}>CH4</Text>
            <Text style={[s.th, s.cVal]}>H2+CH4</Text>
            <Text style={[s.th, s.cVal]}>CO2 %</Text>
            <Text style={[s.th, s.cSym]}>Symptoms</Text>
          </View>
          {data.samples.map((x, i) => {
            const isLast = i === data.samples.length - 1;
            const rowStyle = isLast ? s.trLast : s.tr;
            if (x.skipped) {
              return (
                <View key={x.sampleNumber} style={rowStyle}>
                  <Text style={[s.td, s.cNum]}>{x.sampleNumber}</Text>
                  <Text style={[s.td, s.cTime]}>{x.timeMinutes}</Text>
                  <Text style={[s.td, s.skippedText, { width: "80%" }]}>
                    Skipped — {x.skippedReason || "no reason given"}
                  </Text>
                </View>
              );
            }
            return (
              <View key={x.sampleNumber} style={rowStyle}>
                <Text style={[s.td, s.cNum]}>{x.sampleNumber}</Text>
                <Text style={[s.td, s.cTime]}>{x.timeMinutes}</Text>
                <Text style={[s.td, s.cVal]}>{fmt(x.h2Ppm)}</Text>
                <Text style={[s.td, s.cVal]}>{fmt(x.ch4Ppm)}</Text>
                <Text style={[s.td, s.cVal]}>{fmt(sampleTotal(x.h2Ppm, x.ch4Ppm))}</Text>
                <Text style={[s.td, s.cVal]}>{fmt(x.co2Percent)}</Text>
                <Text style={[s.td, s.cSym]}>{x.symptoms || "—"}</Text>
              </View>
            );
          })}
        </View>

        {/* Pre-test notes */}
        {(data.test.preTestSymptoms || data.test.preTestNotes) && (
          <>
            <Text style={s.sectionTitle}>Pre-test notes</Text>
            {data.test.preTestSymptoms ? (
              <Text style={s.note}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Symptoms: </Text>
                {data.test.preTestSymptoms}
              </Text>
            ) : null}
            {data.test.preTestNotes ? (
              <Text style={s.note}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Notes: </Text>
                {data.test.preTestNotes}
              </Text>
            ) : null}
          </>
        )}

        {/* Diagnosis (physician) — the (Positive/Negative test) tag echoes the
            threshold verdict above; the diagnosis text itself is still
            entirely physician-authored. */}
        <Text style={s.sectionTitle}>Diagnosis</Text>
        {data.diagnosis ? (
          <View style={s.bulletLine}>
            <Text style={s.bulletMark}>-</Text>
            <Text style={s.bulletText}>
              {data.diagnosis}
              {data.resultSummary ? ` (${data.resultSummary.verdict} test)` : ""}
            </Text>
          </View>
        ) : (
          <Text style={s.dxEmpty}>Pending physician review.</Text>
        )}
        {data.recommendation && (
          <>
            <Text style={[s.dxLabel, { marginTop: 8 }]}>Recommendation</Text>
            <Text style={s.dxText}>{data.recommendation}</Text>
          </>
        )}

        {/* Investigator signature */}
        <View style={{ marginTop: 10 }}>
          <Text style={s.signLabel}>Investigator:</Text>
          <View style={[s.signLine, { width: "60%", marginTop: 10 }]}>
            <Text style={s.signName}>{data.signature.name ?? "—"}</Text>
            {(data.signature.title || data.signature.licenseNo) && (
              <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>
                {[data.signature.title, data.signature.licenseNo].filter(Boolean).join(" ")}
              </Text>
            )}
            <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 4 }}>
              Date signed: {data.signature.signedAt ? fmtDate(data.signature.signedAt) : "—"}
            </Text>
          </View>
        </View>

        {/* Interpretation SUPPORT (not a diagnosis) — kept as a closing
            appendix; not part of the reference layout, but required whenever
            a threshold flag is shown (see src/lib/interpretation.ts). */}
        <Text style={s.sectionTitle}>Interpretation support</Text>
        <View style={s.supportBox}>
          {data.interpretation.flags.map((f, i) => (
            <View key={i} style={s.flagLine}>
              <View style={s.flagDot} />
              <Text style={{ fontSize: 8.5, flex: 1 }}>{f.message}{f.detail ? ` ${f.detail}` : ""}</Text>
            </View>
          ))}
          <Text style={s.disclaimer}>{data.interpretation.disclaimer}</Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Confidential patient health information. Generated {fmtDate(data.generatedAt)} by Specter Clinical Platform.
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
