"use client";

import { useActionState, useState } from "react";
import {
  saveDiagnosisAction,
  finalizeAction,
  reopenAction,
  type WorkflowState,
} from "@/app/tests/[id]/workflow-actions";

interface Props {
  testId: string;
  status: "DRAFT" | "IN_PROGRESS" | "FINALIZED";
  diagnosis: string | null;
  recommendation: string | null;
  hasSamples: boolean;
  // capabilities resolved server-side from the viewer's role
  canDiagnose: boolean;
  canFinalize: boolean;
  canReopen: boolean;
  signatureName: string | null;
  signedAt: string | null;
}

export function WorkflowPanel(props: Props) {
  const finalized = props.status === "FINALIZED";

  // ---- Finalized: locked view + reopen ------------------------------------
  if (finalized) {
    return (
      <div className="space-y-4">
        <ReadOnlyBlock label="Diagnosis" value={props.diagnosis} />
        <ReadOnlyBlock label="Recommendation" value={props.recommendation} />
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Signed by <span className="font-semibold">{props.signatureName ?? "—"}</span>
          {props.signedAt ? ` on ${props.signedAt}` : ""}. This report is locked.
        </div>
        {props.canReopen && <ReopenForm testId={props.testId} />}
      </div>
    );
  }

  // ---- Editable: diagnosis editor + save / finalize -----------------------
  if (!props.canDiagnose && !props.canFinalize) {
    return (
      <div className="space-y-4">
        <ReadOnlyBlock label="Diagnosis" value={props.diagnosis} />
        <ReadOnlyBlock label="Recommendation" value={props.recommendation} />
        <p className="text-xs text-slate-400">
          Only a physician can author the diagnosis and finalize this report.
        </p>
      </div>
    );
  }

  return <EditableWorkflow {...props} />;
}

function EditableWorkflow(props: Props) {
  const [diagnosis, setDiagnosis] = useState(props.diagnosis ?? "");
  const [recommendation, setRecommendation] = useState(props.recommendation ?? "");

  const [saveState, saveFormAction, saving] = useActionState<WorkflowState, FormData>(
    saveDiagnosisAction,
    {}
  );
  const [finalizeState, finalizeFormAction, finalizing] = useActionState<WorkflowState, FormData>(
    finalizeAction,
    {}
  );

  const notice = finalizeState.error || saveState.error;
  const ok = finalizeState.ok || saveState.ok;

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{notice}</div>
      )}
      {ok && !notice && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</div>
      )}

      <div>
        <label className="label" htmlFor="diagnosis">
          Diagnosis <span className="text-xs font-normal text-slate-400">(physician-authored)</span>
        </label>
        <textarea
          id="diagnosis"
          name="diagnosis"
          rows={3}
          className="input"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="Physician's final diagnosis…"
        />
      </div>
      <div>
        <label className="label" htmlFor="recommendation">
          Recommendation
        </label>
        <textarea
          id="recommendation"
          name="recommendation"
          rows={3}
          className="input"
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          placeholder="Follow-up / management recommendation…"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Save draft diagnosis */}
        <form action={saveFormAction}>
          <input type="hidden" name="testId" value={props.testId} />
          <input type="hidden" name="diagnosis" value={diagnosis} />
          <input type="hidden" name="recommendation" value={recommendation} />
          <button type="submit" className="btn-secondary" disabled={saving || finalizing}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        {/* Sign & finalize */}
        {props.canFinalize && (
          <form
            action={finalizeFormAction}
            onSubmit={(e) => {
              if (!confirm("Sign and finalize this report? Editing will be locked until it is reopened.")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="testId" value={props.testId} />
            <input type="hidden" name="diagnosis" value={diagnosis} />
            <input type="hidden" name="recommendation" value={recommendation} />
            <button
              type="submit"
              className="btn-primary"
              disabled={finalizing || saving || !props.hasSamples || diagnosis.trim().length === 0}
              title={
                !props.hasSamples
                  ? "Enter samples first"
                  : diagnosis.trim().length === 0
                    ? "Enter a diagnosis first"
                    : undefined
              }
            >
              {finalizing ? "Finalizing…" : "Sign & Finalize"}
            </button>
          </form>
        )}
      </div>
      {props.canFinalize && (diagnosis.trim().length === 0 || !props.hasSamples) && (
        <p className="text-xs text-slate-400">
          {(!props.hasSamples ? "Enter at least one sample" : "Enter a diagnosis") +
            " to enable finalizing."}
        </p>
      )}
    </div>
  );
}

function ReopenForm({ testId }: { testId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<WorkflowState, FormData>(reopenAction, {});

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Reopen report…
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      <input type="hidden" name="testId" value={testId} />
      <label className="label" htmlFor="reason">
        Reason for reopening <span className="text-red-500">*</span>
      </label>
      <textarea
        id="reason"
        name="reason"
        rows={2}
        required
        minLength={5}
        className="input"
        placeholder="Why is this finalized report being reopened? (recorded in the audit trail)"
      />
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Reopening…" : "Confirm reopen"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ReadOnlyBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      {value ? (
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value}</p>
      ) : (
        <p className="mt-0.5 text-sm italic text-slate-400">Pending physician review.</p>
      )}
    </div>
  );
}
