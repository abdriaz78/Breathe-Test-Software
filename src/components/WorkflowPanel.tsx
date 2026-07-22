"use client";

import { useActionState, useState } from "react";
import { saveDiagnosisAction, type WorkflowState } from "@/app/tests/[id]/workflow-actions";

interface Props {
  testId: string;
  status: "DRAFT" | "IN_PROGRESS" | "FINALIZED";
  diagnosis: string | null;
  recommendation: string | null;
  // capabilities resolved server-side from the viewer's role
  canDiagnose: boolean;
}

export function WorkflowPanel(props: Props) {
  const finalized = props.status === "FINALIZED";

  // ---- Finalized: locked, read-only view — terminal, no reopen -----------
  if (finalized) {
    return (
      <div className="space-y-4">
        <ReadOnlyBlock label="Diagnosis" value={props.diagnosis} />
        <ReadOnlyBlock label="Recommendation" value={props.recommendation} />
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Sample collection marked complete. This report is locked.
        </div>
      </div>
    );
  }

  // ---- Editable: diagnosis / recommendation notes -------------------------
  if (!props.canDiagnose) {
    return (
      <div className="space-y-4">
        <ReadOnlyBlock label="Diagnosis" value={props.diagnosis} />
        <ReadOnlyBlock label="Recommendation" value={props.recommendation} />
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

  const notice = saveState.error;
  const ok = saveState.ok;

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
        <form action={saveFormAction}>
          <input type="hidden" name="testId" value={props.testId} />
          <input type="hidden" name="diagnosis" value={diagnosis} />
          <input type="hidden" name="recommendation" value={recommendation} />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
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
