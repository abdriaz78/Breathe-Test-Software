import React from "react";
import fs from "fs";
import path from "path";
import { renderToFile, Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// -----------------------------------------------------------------------------
// Generates a plain-language user guide PDF for the QuinTron Breath Test app.
// Run with:  npx tsx scripts/generate-user-guide.tsx
// -----------------------------------------------------------------------------

const BRAND = "#0f766e";
const INK = "#0f172a";
const MUTED = "#475569";
const BORDER = "#e2e8f0";
const SOFT = "#f1f5f9";

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 54, paddingHorizontal: 48, fontSize: 11, color: INK, fontFamily: "Helvetica", lineHeight: 1.5 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  mark: { width: 26, height: 26, borderRadius: 5, backgroundColor: BRAND, color: "#fff", fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 5, marginRight: 10 },
  brandName: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  brandSub: { fontSize: 10, color: MUTED },
  coverTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", marginTop: 140, marginBottom: 8 },
  coverSub: { fontSize: 13, color: MUTED, marginBottom: 4 },
  coverNote: { marginTop: 24, padding: 12, backgroundColor: SOFT, borderRadius: 6, fontSize: 11, color: MUTED },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BRAND, marginTop: 18, marginBottom: 6 },
  h2: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 3 },
  p: { marginBottom: 6 },
  step: { flexDirection: "row", marginBottom: 5 },
  stepNum: { width: 18, fontFamily: "Helvetica-Bold", color: BRAND },
  stepText: { flex: 1 },
  bullet: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
  dot: { width: 10, color: BRAND },
  bulletText: { flex: 1 },
  tipBox: { marginTop: 6, marginBottom: 6, padding: 10, backgroundColor: "#ecfdf5", borderRadius: 6, borderLeftWidth: 3, borderLeftColor: BRAND },
  warnBox: { marginTop: 6, marginBottom: 6, padding: 10, backgroundColor: "#fffbeb", borderRadius: 6, borderLeftWidth: 3, borderLeftColor: "#d97706" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  thCell: { flex: 1, backgroundColor: SOFT, padding: 6, fontFamily: "Helvetica-Bold", fontSize: 10 },
  tdCell: { flex: 1, padding: 6, fontSize: 10 },
  label: { fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: MUTED },
});

const P = ({ children }: { children: React.ReactNode }) => <Text style={s.p}>{children}</Text>;
const H1 = ({ children }: { children: React.ReactNode }) => <Text style={s.h1}>{children}</Text>;
const H2 = ({ children }: { children: React.ReactNode }) => <Text style={s.h2}>{children}</Text>;

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={s.step}>
      <Text style={s.stepNum}>{n}.</Text>
      <Text style={s.stepText}>{children}</Text>
    </View>
  );
}
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bullet}>
      <Text style={s.dot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}
function Tip({ children }: { children: React.ReactNode }) {
  return <View style={s.tipBox}><Text><Text style={s.label}>Tip: </Text>{children}</Text></View>;
}
function Warn({ children }: { children: React.ReactNode }) {
  return <View style={s.warnBox}><Text><Text style={s.label}>Important: </Text>{children}</Text></View>;
}
function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>QuinTron Breath Test - User Guide - Specter Clinical Platform</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
function Brand() {
  return (
    <View style={s.brandRow}>
      <Text style={s.mark}>S</Text>
      <View>
        <Text style={s.brandName}>QuinTron Breath Test</Text>
        <Text style={s.brandSub}>Specter Clinical Platform</Text>
      </View>
    </View>
  );
}

const Guide = () => (
  <Document title="QuinTron Breath Test - User Guide" author="Specter Clinical Platform">
    {/* Cover */}
    <Page size="A4" style={s.page}>
      <Brand />
      <Text style={s.coverTitle}>User Guide</Text>
      <Text style={s.coverSub}>How to use the Breath Test system - in easy steps.</Text>
      <Text style={s.coverSub}>For nurses, lab technicians, doctors, and administrators.</Text>
      <View style={s.coverNote}>
        <Text>
          This guide shows you each task, one step at a time. You do not need any computer
          knowledge to follow it. If you cannot see a button that this guide mentions, it
          simply means that job is not part of your role.
        </Text>
      </View>
      <Footer />
    </Page>

    {/* What it is + Login + Roles */}
    <Page size="A4" style={s.page}>
      <H1>1. What is this system?</H1>
      <P>
        It is a program for hospitals that use QuinTron breath test machines. It helps you save
        a patient's breath test, turn the readings into a chart, and make a neat report that a
        doctor can check and sign.
      </P>
      <H2>What you can do with it</H2>
      <Bullet>Add a patient.</Bullet>
      <Bullet>Start a breath test (for example: SIBO Glucose, Lactose, or Fructose).</Bullet>
      <Bullet>Type in the breath readings taken during the test.</Bullet>
      <Bullet>See the results drawn as a chart, made for you.</Bullet>
      <Bullet>Let the doctor write the result and sign it.</Bullet>
      <Bullet>Save the report as a PDF, share it, or save the data as a spreadsheet.</Bullet>

      <Warn>
        The system never decides the result on its own. It may show a few helpful hints, but the
        final result is always written and signed by a doctor.
      </Warn>

      <H1>2. Logging in</H1>
      <Step n={1}>Open the web page your hospital gave you.</Step>
      <Step n={2}>Type your email and password.</Step>
      <Step n={3}>Click "Sign in".</Step>
      <Tip>If it will not let you in, check your email and password are spelled correctly. If it still will not work, ask your administrator.</Tip>

      <H1>3. Who can do what</H1>
      <View style={s.tableRow}>
        <Text style={s.thCell}>Role</Text>
        <Text style={[s.thCell, { flex: 2 }]}>What they can do</Text>
      </View>
      <View style={s.tableRow}>
        <Text style={s.tdCell}>Nurse / Lab Technician</Text>
        <Text style={[s.tdCell, { flex: 2 }]}>Add patients, start tests, type in readings, and share reports.</Text>
      </View>
      <View style={s.tableRow}>
        <Text style={s.tdCell}>Doctor</Text>
        <Text style={[s.tdCell, { flex: 2 }]}>Check a test, write the result, and sign it. Can reopen a signed report if needed.</Text>
      </View>
      <View style={s.tableRow}>
        <Text style={s.tdCell}>Administrator</Text>
        <Text style={[s.tdCell, { flex: 2 }]}>Manage staff accounts, test types, hospitals, and view the activity list.</Text>
      </View>
      <View style={s.tableRow}>
        <Text style={s.tdCell}>Specter Support</Text>
        <Text style={[s.tdCell, { flex: 2 }]}>Help with setup. Can look at reports but cannot sign them.</Text>
      </View>
      <Footer />
    </Page>

    {/* Patient + Test */}
    <Page size="A4" style={s.page}>
      <H1>4. Add a patient</H1>
      <Step n={1}>On the home page, click "Patients".</Step>
      <Step n={2}>Click "Register patient".</Step>
      <Step n={3}>Fill in the boxes: patient ID (their hospital number), name, date of birth, gender, weight, hospital, and referring doctor.</Step>
      <Step n={4}>Click "Register patient" to save.</Step>
      <Tip>Patient details are kept private and safe. Only the right staff can see them.</Tip>

      <H1>5. Start a breath test</H1>
      <Step n={1}>Open the patient, then click "New breath test".</Step>
      <Step n={2}>Pick the test type. The substrate and dose fill in for you, but you can change them if you need to.</Step>
      <Step n={3}>Add the department, the dates, and the nurse or technician doing the test.</Step>
      <Step n={4}>Write down any symptoms or notes from before the test.</Step>
      <Step n={5}>Click "Create test". The test now shows as a "Draft".</Step>

      <H2>What the test labels mean</H2>
      <Bullet><Text style={s.label}>Draft:</Text> just started, no readings yet.</Bullet>
      <Bullet><Text style={s.label}>In Progress:</Text> readings added, waiting for the doctor.</Bullet>
      <Bullet><Text style={s.label}>Finalized:</Text> signed by the doctor and locked.</Bullet>
      <Footer />
    </Page>

    {/* Samples + Chart */}
    <Page size="A4" style={s.page}>
      <H1>6. Type in the readings</H1>
      <Step n={1}>Open the test and click "Enter samples".</Step>
      <Step n={2}>Each row is one reading. Type the row number, the time in minutes, and the two gas numbers (H2 and CH4) from the machine.</Step>
      <Step n={3}>The system adds H2 and CH4 together for you. You do not need to do any maths.</Step>
      <Step n={4}>Fill in the other machine readings and any symptoms if you have them.</Step>
      <Step n={5}>Click "+ Add sample" to add another row. Click "Save samples" when you are done.</Step>

      <H2>If a reading was skipped</H2>
      <P>Tick the "Skip" box on that row and write the reason (for example, "patient stepped out"). A short reason is needed so nothing is left unexplained.</P>
      <Tip>You can go back and change the readings at any time, right up until the doctor signs the report.</Tip>

      <H1>7. See the chart</H1>
      <P>
        As soon as you save some readings, the test page draws a chart for you. It shows how the
        two gases and their total change over time. The same chart appears in the report.
      </P>
      <Footer />
    </Page>

    {/* Diagnosis + Report + Export */}
    <Page size="A4" style={s.page}>
      <H1>8. Writing the result and signing (doctor only)</H1>
      <Step n={1}>Open the test and go to the doctor's review section.</Step>
      <Step n={2}>The doctor writes the result and any advice for the patient.</Step>
      <Step n={3}>Click "Save" to keep it for later, or "Sign and Finalize" to finish and lock the report.</Step>
      <Warn>Once a report is signed, it cannot be changed. If a change is really needed, a doctor or administrator can "Reopen" it and give a reason. That reason is kept on record.</Warn>
      <P>The system may show a few helpful hints, but they are only there to help. The doctor always makes the final decision.</P>

      <H1>9. Save, share, and print</H1>
      <H2>Save the report as a PDF</H2>
      <Step n={1}>Open the test.</Step>
      <Step n={2}>Click "Download PDF". The full report opens, ready to print or save.</Step>
      <H2>Share the report</H2>
      <Bullet>Click "Share" to copy a link or start an email.</Bullet>
      <Bullet>The person you send it to needs their own login to open it.</Bullet>
      <H2>Save the data as a spreadsheet</H2>
      <Bullet>On a test, click "Export" to save that test's readings.</Bullet>
      <Bullet>On the tests list, click "Export" to save a summary of many tests.</Bullet>
      <Tip>These files open straight away in Microsoft Excel.</Tip>
      <Footer />
    </Page>

    {/* Admin + Safety + Help */}
    <Page size="A4" style={s.page}>
      <H1>10. Administrator tasks</H1>
      <P>Only administrators can see these (and some of them, Specter Support).</P>
      <H2>Staff accounts</H2>
      <Bullet>Add a staff member with their name, email, role, and a first password.</Bullet>
      <Bullet>Change someone's role, or turn an account on or off.</Bullet>
      <H2>Test types</H2>
      <Bullet>Add your own test types.</Bullet>
      <Bullet>Set the substrate and dose that fill in by default.</Bullet>
      <H2>Hospitals and departments</H2>
      <Bullet>Add hospitals, and add departments inside each hospital.</Bullet>
      <H2>Activity list</H2>
      <Bullet>See who did what and when: logins, changes, and sign-offs.</Bullet>

      <H1>11. Safety and privacy</H1>
      <Bullet>Patient details are kept private and safe.</Bullet>
      <Bullet>Every important action is written down automatically.</Bullet>
      <Bullet>The system never decides a result by itself. The doctor is always in charge.</Bullet>

      <H1>12. Need help?</H1>
      <P>
        If something does not work, or a button you expect is not there, ask your hospital
        administrator or Specter Support. Most of the time, a missing button just means that job
        is not part of your role.
      </P>
      <Footer />
    </Page>
  </Document>
);

async function main() {
  const outDir = path.join(process.cwd(), "docs");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "QuinTron-Breath-Test-User-Guide.pdf");
  await renderToFile(<Guide />, outPath);
  console.log("Wrote user guide:", outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
