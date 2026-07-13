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
  page: { paddingTop: 36, paddingBottom: 54, paddingHorizontal: 40, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 8 },
  brandBox: { flexDirection: "row", alignItems: "center" },
  brandMark: { width: 22, height: 22, borderRadius: 4, backgroundColor: BRAND, color: "#fff", fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 4, marginRight: 8 },
  brandName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: INK },
  brandSub: { fontSize: 8, color: MUTED },
  hospRight: { textAlign: "right", alignItems: "flex-end", maxWidth: 300 },
  hospLogo: { height: 58, maxWidth: 280, objectFit: "contain", marginBottom: 6 },
  hospName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  hospSub: { fontSize: 8, color: MUTED },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 2 },
  statusPill: { alignSelf: "flex-start", marginTop: 4, marginBottom: 6, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, fontSize: 8, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", marginBottom: 5, paddingRight: 10 },
  cellThird: { width: "33.33%", marginBottom: 5, paddingRight: 10 },
  fieldLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase" },
  fieldValue: { fontSize: 9.5, marginTop: 1 },
  // table
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 3, marginTop: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  trLast: { flexDirection: "row" },
  th: { backgroundColor: "#f1f5f9", fontFamily: "Helvetica-Bold", fontSize: 7.5, padding: 4 },
  td: { padding: 4, fontSize: 8 },
  cNum: { width: "8%" },
  cTime: { width: "12%" },
  cVal: { width: "12%", textAlign: "right" },
  cSym: { width: "32%" },
  skippedText: { color: MUTED, fontStyle: "italic" },
  note: { marginTop: 4, lineHeight: 1.4 },
  supportBox: { marginTop: 6, borderWidth: 1, borderColor: "#fcd34d", backgroundColor: "#fffbeb", borderRadius: 3, padding: 8 },
  flagLine: { marginBottom: 3, flexDirection: "row" },
  flagDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#b45309", marginTop: 4, marginRight: 5 },
  disclaimer: { marginTop: 6, fontSize: 7.5, color: "#92400e", lineHeight: 1.4 },
  dxBox: { marginTop: 6, borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 10, minHeight: 60 },
  dxLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", marginBottom: 3 },
  dxText: { fontSize: 9.5, lineHeight: 1.4 },
  dxEmpty: { fontSize: 9, color: MUTED, fontStyle: "italic" },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  signBox: { width: "48%" },
  signLine: { borderTopWidth: 1, borderTopColor: INK, marginTop: 22, paddingTop: 3 },
  signLabel: { fontSize: 7.5, color: MUTED },
  signName: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
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

        <Text style={s.title}>Hydrogen / Methane Breath Test Report</Text>
        <Text style={[s.statusPill, { backgroundColor: pill.bg, color: pill.color }]}>{pill.label}</Text>

        {/* Patient */}
        <Text style={s.sectionTitle}>Patient</Text>
        <View style={s.grid}>
          <Field label="Name" value={data.patient.name} />
          <Field label="MRN / Patient ID" value={data.patient.mrn} />
          <Field label="Date of birth" value={fmtDate(data.patient.dob)} />
          <Field label="Gender" value={GENDER[data.patient.gender] ?? data.patient.gender} />
          <Field label="Weight" value={data.patient.weightKg != null ? `${data.patient.weightKg} kg` : "—"} />
          <Field label="Referring physician" value={data.patient.referringPhysician ?? "—"} />
        </View>

        {/* Test */}
        <Text style={s.sectionTitle}>Test details</Text>
        <View style={s.grid}>
          <Field label="Test type" value={data.test.typeName} third />
          <Field label="Substrate" value={data.test.substrate ?? "—"} third />
          <Field label="Dose" value={data.test.dose ?? "—"} third />
          <Field label="Collection date" value={fmtDate(data.test.collectionDate)} third />
          <Field label="Analysis date" value={fmtDate(data.test.analysisDate)} third />
          <Field label="Technician" value={data.test.technicianName ?? "—"} third />
        </View>

        {/* Charts — H2 (baseline + threshold) and CH4 (fixed trigger) */}
        {data.samples.some((x) => !x.skipped) && (
          <>
            <Text style={s.sectionTitle}>H2 over time</Text>
            <ReportChart samples={chartSamples} series={["h2"]} h2RiseThreshold={data.h2RiseThreshold} />
            <Text style={s.sectionTitle}>CH4 over time</Text>
            <ReportChart samples={chartSamples} series={["ch4"]} ch4Threshold={CH4_TRIGGER_PPM} />
          </>
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

        {/* Interpretation SUPPORT (not a diagnosis) */}
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

        {/* Physician diagnosis / recommendation */}
        <Text style={s.sectionTitle}>Diagnosis & recommendation (physician)</Text>
        <View style={s.dxBox}>
          <Text style={s.dxLabel}>Diagnosis</Text>
          {data.diagnosis ? (
            <Text style={s.dxText}>{data.diagnosis}</Text>
          ) : (
            <Text style={s.dxEmpty}>Pending physician review.</Text>
          )}
          <Text style={[s.dxLabel, { marginTop: 8 }]}>Recommendation</Text>
          {data.recommendation ? (
            <Text style={s.dxText}>{data.recommendation}</Text>
          ) : (
            <Text style={s.dxEmpty}>Pending physician review.</Text>
          )}
        </View>

        {/* Signature */}
        <View style={s.signRow}>
          <View style={s.signBox}>
            <View style={s.signLine}>
              <Text style={s.signLabel}>Reviewing physician</Text>
              <Text style={s.signName}>{data.signature.name ?? "—"}</Text>
            </View>
          </View>
          <View style={s.signBox}>
            <View style={s.signLine}>
              <Text style={s.signLabel}>Date signed</Text>
              <Text style={s.signName}>
                {data.signature.signedAt ? fmtDate(data.signature.signedAt) : "—"}
              </Text>
            </View>
          </View>
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
