"use client";

import { useActionState, useRef, useState } from "react";
import { recordShareAction, type ShareState } from "@/app/tests/[id]/share-actions";

export function ShareButton({ testId, patientMrn }: { testId: string; patientMrn: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ShareState, FormData>(recordShareAction, {});
  const recipientRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const reportUrl = () =>
    typeof window !== "undefined" ? `${window.location.origin}/api/tests/${testId}/report` : "";

  function onEmail(e: React.MouseEvent) {
    // Let the form action run (audit); also open a mailto draft with the link.
    const to = recipientRef.current?.value ?? "";
    const subject = encodeURIComponent(`Breath test report — MRN ${patientMrn}`);
    const body = encodeURIComponent(
      `A breath test report is available for review.\n\nReport (PDF): ${reportUrl()}\n\n(Requires an authorized login.)`
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(reportUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked; the form still logs the share */
    }
  }

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Share
      </button>
    );
  }

  return (
    <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-clinical-border bg-white p-4 shadow-lg">
      <p className="mb-2 text-sm font-medium text-slate-900">Share report</p>
      {state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
      {state.ok && <p className="mb-2 text-xs text-emerald-600">{state.ok}</p>}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="testId" value={testId} />
        <div>
          <label className="label" htmlFor="recipient">Recipient email (optional)</label>
          <input ref={recipientRef} id="recipient" name="recipient" type="email" className="input" placeholder="physician@hospital.ae" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="method" value="email" className="btn-primary" onClick={onEmail}>
            Email draft
          </button>
          <button type="submit" name="method" value="link" className="btn-secondary" onClick={onCopy}>
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs text-slate-400">
        Recipients need an authorized login to open the report. Email delivery integration is a
        deployment-phase step; this opens a draft in your mail client.
      </p>
    </div>
  );
}
