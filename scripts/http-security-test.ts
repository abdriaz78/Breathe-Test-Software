import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

// -----------------------------------------------------------------------------
// HTTP-level security + PWA test against a RUNNING server.
//
//   BASE_URL=http://localhost:3000 npx tsx scripts/http-security-test.ts
//
// Signs in through the real NextAuth endpoints (staff and patient), then
// tries to reach data across patients, hospitals and session kinds. Uses the
// same DATABASE_URL as the server to set up its own throwaway records.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { createPatient } from "@/lib/patients";
import { createTest } from "@/lib/tests";
import { saveSamples } from "@/lib/samples";
import { completeSampleCollection } from "@/lib/workflow";
import { createUser, setUserActive } from "@/lib/admin-users";
import { createHospital } from "@/lib/admin-hospitals";
import { issuePortalAccess, changeOwnPassword } from "@/lib/portal";
import { MAX_FAILED_ATTEMPTS } from "@/lib/credentials";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ctx = { ipAddress: "127.0.0.1", userAgent: "http-security-test" };
let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " -> " + detail : ""}`); }
}

class Client {
  cookies = new Map<string, string>();
  private store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (v === "" || /max-age=0/i.test(c) || /expires=thu, 01 jan 1970/i.test(c)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  async get(path: string) {
    const res = await fetch(BASE + path, { headers: { cookie: this.header() }, redirect: "manual" });
    this.store(res);
    return res;
  }
  async signIn(provider: "credentials" | "patient", fields: Record<string, string>) {
    const csrfRes = await this.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const body = new URLSearchParams({ ...fields, csrfToken, json: "true", callbackUrl: BASE + "/" });
    const res = await fetch(`${BASE}/api/auth/callback/${provider}`, {
      method: "POST",
      headers: { cookie: this.header(), "content-type": "application/x-www-form-urlencoded" },
      body,
      redirect: "manual",
    });
    this.store(res);
    // NextAuth answers json=true sign-ins with { url }; failures carry ?error=.
    const data = (await res.json().catch(() => ({}))) as { url?: string };
    const error = data.url ? new URL(data.url, BASE).searchParams.get("error") : null;
    return { ok: !error && res.status === 200 && [...this.cookies.keys()].some((k) => k.includes("session-token")), error };
  }
}

const location = (r: Response) => new URL(r.headers.get("location") ?? "", BASE).pathname;

/**
 * What a browser ends up with. Middleware answers with real 3xx redirects;
 * server components that call redirect()/notFound() after the root
 * loading.tsx has streamed answer 200 with a Next.js marker instead, which the
 * client router acts on. Either way we also return the body so callers can
 * assert that no patient data leaked into it.
 */
async function outcome(res: Response): Promise<{ kind: "redirect" | "404" | "ok" | string; to?: string; body: string }> {
  if (res.status >= 300 && res.status < 400) return { kind: "redirect", to: location(res), body: "" };
  const body = await res.text();
  const rd = body.match(/NEXT_REDIRECT;(?:replace|push);([^;"\\]+);/);
  if (rd) return { kind: "redirect", to: new URL(rd[1], BASE).pathname, body };
  if (res.status === 404 || /NEXT_HTTP_ERROR_FALLBACK;404/.test(body)) return { kind: "404", body };
  return { kind: res.status === 200 ? "ok" : String(res.status), body };
}
async function is404NoLeak(res: Response, ...secrets: string[]) {
  const o = await outcome(res);
  return o.kind === "404" && secrets.every((x) => !o.body.includes(x));
}
async function redirectsTo(res: Response, path: string) {
  const o = await outcome(res);
  return o.kind === "redirect" && o.to === path;
}

async function asUser(email: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, hospitalId: u.hospitalId };
}

async function main() {
  console.log(`=== HTTP security & PWA test against ${BASE} ===\n`);
  const s = Date.now().toString().slice(-7);
  const admin = await asUser("admin@specter.health");
  const nurseA = await asUser("nurse@specter.health");
  const sibo = await prisma.testType.findUniqueOrThrow({ where: { key: "SIBO_GLUCOSE" } });

  const { id: hB } = await createHospital(admin, { name: `HTTP Hospital ${s}`, code: `HTTP-${s}` }, ctx);
  const nurseBEmail = `http.nurse.b.${s}@test.local`;
  await createUser(admin, { email: nurseBEmail, name: "HTTP Nurse B", role: "NURSE", password: "Passw0rd!", hospitalId: hB }, ctx);
  const nurseB = await asUser(nurseBEmail);

  const mkPatient = (mrn: string, name: string, hospitalId: string, who: CurrentUser) =>
    createPatient(who, { mrn, name, dob: "1990-01-01", gender: "MALE", hospitalId }, ctx);
  const finalized = async (who: CurrentUser, patientId: string) => {
    const { id } = await createTest(who, { patientId, testTypeId: sibo.id } as never, ctx);
    await saveSamples(who, id, [{ sampleNumber: 0, timeMinutes: 0, h2Ppm: 5, ch4Ppm: 1 }] as never, ctx);
    await completeSampleCollection(who, id, ctx);
    return id;
  };
  const { id: p1 } = await mkPatient(`H1-${s}`, "Http Patient One", nurseA.hospitalId!, nurseA);
  const { id: p2 } = await mkPatient(`H2-${s}`, "Http Patient Two", nurseA.hospitalId!, nurseA);
  const { id: p3 } = await mkPatient(`H3-${s}`, "Http Patient Three", hB, nurseB);
  const t1 = await finalized(nurseA, p1);
  const t2 = await finalized(nurseA, p2);
  const t3 = await finalized(nurseB, p3);
  const { id: t1draft } = await createTest(nurseA, { patientId: p1, testTypeId: sibo.id } as never, ctx);

  console.log("[1] PWA assets are public and correct");
  const anon = new Client();
  const man = await anon.get("/manifest.webmanifest");
  const manifest = man.status === 200 ? await man.json() : null;
  check("manifest served (200, JSON)", man.status === 200 && /manifest\+json|json/.test(man.headers.get("content-type") ?? ""), String(man.status));
  check("manifest: name, short_name, start_url, scope, display=standalone",
    !!manifest?.name && !!manifest?.short_name && !!manifest?.start_url && manifest?.scope === "/" && manifest?.display === "standalone");
  const sizes = (manifest?.icons ?? []).map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose ?? "any"}`);
  check("manifest: 192 + 512 'any' icons and a maskable icon", sizes.includes("192x192:any") && sizes.includes("512x512:any") && sizes.some((x: string) => x.endsWith(":maskable")), sizes.join(","));
  for (const icon of manifest?.icons ?? []) {
    const r = await anon.get(icon.src);
    check(`icon ${icon.src} served`, r.status === 200 && (r.headers.get("content-type") ?? "").startsWith("image/"), String(r.status));
  }
  const sw = await anon.get("/sw.js");
  const swText = await sw.text();
  check("service worker served as JS", sw.status === 200 && (sw.headers.get("content-type") ?? "").includes("javascript"));
  check("service worker not HTTP-cached", /no-cache|no-store/.test(sw.headers.get("cache-control") ?? ""));
  check("service worker never caches /api/", swText.includes('startsWith("/api/")'));
  check("offline page served", (await anon.get("/offline.html")).status === 200);
  check("apple-touch-icon served", (await anon.get("/apple-touch-icon.png")).status === 200);
  const login = await anon.get("/login");
  const loginHtml = await login.text();
  check("login page links the manifest", loginHtml.includes('rel="manifest"'));
  check("login page has theme-color + apple-touch-icon", loginHtml.includes('name="theme-color"') && loginHtml.includes("apple-touch-icon"));
  check("CSP header on pages", (login.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"));
  check("HSTS header present", !!login.headers.get("strict-transport-security"));
  check("X-Powered-By hidden", !login.headers.get("x-powered-by"));
  check("portal login page public", (await anon.get("/portal/login")).status === 200);

  console.log("\n[2] Anonymous access is blocked");
  check("/ redirects to /login", location(await anon.get("/")) === "/login");
  check("/patients redirects to /login", location(await anon.get("/patients")) === "/login");
  check("/portal redirects to /portal/login", location(await anon.get("/portal")) === "/portal/login");
  check("staff PDF API -> 401", (await anon.get(`/api/tests/${t1}/report`)).status === 401);
  check("portal PDF API -> 401", (await anon.get(`/api/portal/reports/${t1}`)).status === 401);
  check("CSV export -> 401", (await anon.get(`/api/tests/export.csv`)).status === 401);

  console.log("\n[3] Patient session (patient 1)");
  const { tempPassword } = await issuePortalAccess(nurseA, p1, ctx);
  const pat = new Client();
  check("wrong patient password rejected", !(await new Client().signIn("patient", { mrn: `H1-${s}`, password: "wrong-pass9" })).ok);
  check("patient signs in with MRN + temp password", (await pat.signIn("patient", { mrn: `H1-${s}`, password: tempPassword })).ok);
  check("temp password forces change-password first", await redirectsTo(await pat.get("/portal"), "/portal/change-password"));
  check("PDF blocked until password changed (403)", (await pat.get(`/api/portal/reports/${t1}`)).status === 403);
  const acct = await prisma.patientAccount.findUniqueOrThrow({ where: { patientId: p1 } });
  await changeOwnPassword({ accountId: acct.id, patientId: p1 }, tempPassword, "HttpPass123", ctx);
  const home = await pat.get("/portal");
  const homeHtml = await home.text();
  check("portal home loads", home.status === 200);
  check("portal shows own name", homeHtml.includes("Http Patient One"));
  check("portal does not show other patients", !homeHtml.includes("Http Patient Two") && !homeHtml.includes("Http Patient Three"));
  check("portal lists own finalized report", homeHtml.includes(`/api/portal/reports/${t1}`));
  check("portal hides own draft report", !homeHtml.includes(t1draft));
  const pdf = await pat.get(`/api/portal/reports/${t1}`);
  const pdfBuf = Buffer.from(await pdf.arrayBuffer());
  check("own report PDF downloads", pdf.status === 200 && pdfBuf.subarray(0, 5).toString() === "%PDF-", String(pdf.status));
  check("PDF not cacheable", /no-store/.test(pdf.headers.get("cache-control") ?? ""));
  check("same-hospital other patient's report -> 404", (await pat.get(`/api/portal/reports/${t2}`)).status === 404);
  check("other hospital's report -> 404", (await pat.get(`/api/portal/reports/${t3}`)).status === 404);
  check("own draft report -> 404", (await pat.get(`/api/portal/reports/${t1draft}`)).status === 404);
  check("patient cannot reach staff dashboard (-> /portal)", location(await pat.get("/")) === "/portal");
  check("patient cannot reach /patients/<own id>", location(await pat.get(`/patients/${p1}`)) === "/portal");
  check("patient cannot reach /tests/<own test>", location(await pat.get(`/tests/${t1}`)) === "/portal");
  check("patient cannot reach admin pages", location(await pat.get("/admin/users")) === "/portal");
  check("patient blocked from staff PDF API (403)", (await pat.get(`/api/tests/${t1}/report`)).status === 403);
  check("patient blocked from samples CSV (403)", (await pat.get(`/api/tests/${t1}/samples.csv`)).status === 403);
  check("patient blocked from CSV export (403)", (await pat.get(`/api/tests/export.csv`)).status === 403);
  check("patient blocked from timers API (403)", (await pat.get(`/api/timers`)).status === 403);
  const sess = await (await pat.get("/api/auth/session")).json();
  check("patient session exposes no role and no name/PHI", !sess?.user?.role && !JSON.stringify(sess).includes("Http Patient"), JSON.stringify(sess));

  console.log("\n[4] Staff of another hospital (nurse B)");
  const nb = new Client();
  check("nurse B signs in", (await nb.signIn("credentials", { email: nurseBEmail, password: "Passw0rd!" })).ok);
  check("nurse B: hospital A PDF -> 404", (await nb.get(`/api/tests/${t1}/report`)).status === 404);
  check("nurse B: hospital A samples CSV -> 404", (await nb.get(`/api/tests/${t1}/samples.csv`)).status === 404);
  const secretA = ["Http Patient One", `H1-${s}`];
  check("nurse B: hospital A test page -> 404, no PHI", await is404NoLeak(await nb.get(`/tests/${t1}`), ...secretA));
  check("nurse B: hospital A samples page -> 404, no PHI", await is404NoLeak(await nb.get(`/tests/${t1}/samples`), ...secretA));
  check("nurse B: hospital A patient page -> 404, no PHI", await is404NoLeak(await nb.get(`/patients/${p1}`), ...secretA));
  check("nurse B: hospital A patient edit page -> 404, no PHI", await is404NoLeak(await nb.get(`/patients/${p1}/edit`), ...secretA));
  check("nurse B: new test for hospital A patient -> 404, no PHI", await is404NoLeak(await nb.get(`/tests/new?patientId=${p1}`), ...secretA));
  const dash = await (await nb.get("/")).text();
  check("nurse B: dashboard shows no hospital A patients", !dash.includes("Http Patient One") && !dash.includes("Http Patient Two"));
  check("nurse B: audit log page refused", await redirectsTo(await nb.get("/admin/audit"), "/"));
  const csv = await (await nb.get(`/api/tests/export.csv`)).text();
  check("nurse B: CSV export has no hospital A rows", !csv.includes(`H1-${s}`) && !csv.includes(`H2-${s}`) && csv.includes(`H3-${s}`));
  const list = await (await nb.get(`/patients?q=Http`)).text();
  check("nurse B: patient search shows only own hospital", list.includes("Http Patient Three") && !list.includes("Http Patient One"));
  check("nurse B: own hospital PDF works", (await nb.get(`/api/tests/${t3}/report`)).status === 200);
  check("staff cannot use the patient portal (-> /)", location(await nb.get("/portal")) === "/");
  check("staff blocked from portal PDF API (403)", (await nb.get(`/api/portal/reports/${t3}`)).status === 403);

  console.log("\n[5] Same-hospital staff still works (nurse A)");
  const na = new Client();
  check("nurse A signs in", (await na.signIn("credentials", { email: "nurse@specter.health", password: process.env.SEED_PASSWORD || "Passw0rd!" })).ok);
  check("nurse A: own PDF works", (await na.get(`/api/tests/${t1}/report`)).status === 200);
  const pPage = await (await na.get(`/patients/${p1}`)).text();
  check("nurse A: patient page shows portal access card", pPage.includes("Patient portal access"));

  console.log("\n[6] Revocation takes effect immediately over HTTP");
  await setUserActive(admin, nurseB.id, false, ctx);
  check("deactivated nurse B: pages bounce to /login", await redirectsTo(await nb.get("/tests"), "/login"));
  check("deactivated nurse B: API -> 401", (await nb.get(`/api/tests/${t3}/report`)).status === 401);
  await issuePortalAccess(nurseA, p1, ctx); // reset revokes patient sessions
  check("reset patient: portal bounces to /portal/login", await redirectsTo(await pat.get("/portal"), "/portal/login"));
  check("reset patient: PDF API -> 401", (await pat.get(`/api/portal/reports/${t1}`)).status === 401);

  console.log("\n[7] Brute-force lockout over HTTP");
  const lockEmail = `http.lock.${s}@test.local`;
  await createUser(admin, { email: lockEmail, name: "Lock", role: "NURSE", password: "Passw0rd!", hospitalId: nurseA.hospitalId! }, ctx);
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await new Client().signIn("credentials", { email: lockEmail, password: `bad${i}` });
  const locked = await new Client().signIn("credentials", { email: lockEmail, password: "Passw0rd!" });
  check("correct password refused while locked", !locked.ok && /Too many failed attempts/.test(locked.error ?? ""), String(locked.error));

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await prisma.$disconnect();
  process.exit(1);
});
