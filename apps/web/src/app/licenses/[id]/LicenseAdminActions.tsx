"use client";

import type { ButtonHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { cadenceSourceLabel, formatCadenceMonths } from "@/lib/cadence";

const utcFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC"
});

function addMonthsUtc(base: Date, months: number) {
  const result = new Date(base.getTime());
  const dayOfMonth = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));

  return result;
}

function formatDate(value: Date | string) {
  return utcFormatter.format(new Date(value));
}

type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  actionId?: string;
};

const initialActionState: ActionState = { status: "idle" };

function PendingButton({
  children,
  pendingLabel,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      aria-busy={pending ? "true" : undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <div className="detail-item" role="status" aria-live="polite">
      {state.message}
    </div>
  );
}

export function LicenseAdminActions({
  licenseId,
  effectiveStatus,
  expiresAt,
  renderedAtUtc,
  renewalCadenceMonths,
  renewalCadenceSource,
  planRenewalCadenceMonths,
  activationLink,
  activationToken,
  canRenew,
  lifecycleAction,
  renewAction
}: {
  licenseId: string;
  effectiveStatus: string;
  expiresAt: string;
  renderedAtUtc: string;
  renewalCadenceMonths: number;
  renewalCadenceSource: string;
  planRenewalCadenceMonths: number | null;
  activationLink: string;
  activationToken: string;
  canRenew: boolean;
  lifecycleAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  renewAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [customMonths, setCustomMonths] = useState("1");
  const [notice, setNotice] = useState<string | null>(null);
  const [lifecycleState, lifecycleFormAction] = useFormState(lifecycleAction, initialActionState);
  const [renewalState, renewalFormAction] = useFormState(renewAction, initialActionState);
  const lifecycleSuccessRef = useRef<string | null>(null);
  const renewalSuccessRef = useRef<string | null>(null);

  const baseDate = effectiveStatus === "EXPIRED" ? new Date(renderedAtUtc) : new Date(expiresAt);
  const resultingExpiry = addMonthsUtc(baseDate, selectedMonths);

  useEffect(() => {
    if (lifecycleState.status === "success" && lifecycleState.actionId && lifecycleSuccessRef.current !== lifecycleState.actionId) {
      lifecycleSuccessRef.current = lifecycleState.actionId;
      router.refresh();
    }
  }, [lifecycleState.actionId, lifecycleState.status, router]);

  useEffect(() => {
    if (renewalState.status === "success" && renewalState.actionId && renewalSuccessRef.current !== renewalState.actionId) {
      renewalSuccessRef.current = renewalState.actionId;
      router.refresh();
    }
  }, [renewalState.actionId, renewalState.status, router]);

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied to clipboard.`);
    } catch {
      setNotice(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <div className="stack">
      <div className="actions" style={{ flexWrap: "wrap" }}>
        <button className="btn secondary" type="button" disabled={!activationLink} onClick={() => copyToClipboard(activationLink, "Activation link")}>
          Copy activation link
        </button>
        <button className="btn secondary" type="button" disabled={!activationToken} onClick={() => copyToClipboard(activationToken, "Activation token")}>
          Copy activation token
        </button>
      </div>

      {notice ? (
        <div className="detail-item" role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}

      <form action={lifecycleFormAction} className="stack">
        <input type="hidden" name="id" value={licenseId} />
        <div className="actions" style={{ flexWrap: "wrap" }}>
          <PendingButton className="btn danger" type="submit" name="action" value="revoke" pendingLabel="Revoking...">
            Revoke
          </PendingButton>
          <PendingButton className="btn secondary" type="submit" name="action" value="suspend" pendingLabel="Suspending...">
            Suspend
          </PendingButton>
          <PendingButton className="btn secondary" type="submit" name="action" value="reactivate" pendingLabel="Reactivating...">
            Reactivate
          </PendingButton>
        </div>
        <label>
          Extend expiry
          <input name="expiresAt" type="datetime-local" />
        </label>
        <PendingButton className="btn secondary" type="submit" name="action" value="extend" pendingLabel="Extending...">
          Extend
        </PendingButton>
        <ActionMessage state={lifecycleState} />
      </form>

      <form action={renewalFormAction} className="stack">
        <input type="hidden" name="months" value={selectedMonths} />
        <div className="detail-item">
          <div><strong>Effective cadence:</strong> {formatCadenceMonths(renewalCadenceMonths)}</div>
          <div className="meta"><strong>Source:</strong> {cadenceSourceLabel(renewalCadenceSource)}</div>
          {planRenewalCadenceMonths ? (
            <div className="meta"><strong>Plan default:</strong> {formatCadenceMonths(planRenewalCadenceMonths)}</div>
          ) : null}
        </div>
        {!canRenew ? (
          <div className="detail-item" role="note">
            Renewal is unavailable for revoked licenses.
          </div>
        ) : null}

        <div className="actions" style={{ flexWrap: "wrap" }}>
          <button className={selectedMonths === 1 ? "btn" : "btn secondary"} type="button" disabled={!canRenew} onClick={() => setSelectedMonths(1)}>
            Rearm +1 month
          </button>
          <button className={selectedMonths === 3 ? "btn" : "btn secondary"} type="button" disabled={!canRenew} onClick={() => setSelectedMonths(3)}>
            Rearm +3 months
          </button>
          <button className={selectedMonths === 12 ? "btn" : "btn secondary"} type="button" disabled={!canRenew} onClick={() => setSelectedMonths(12)}>
            Rearm +12 months
          </button>
        </div>

        <div className="grid two">
          <label>
            Custom period in months
            <input
              name="customMonths"
              type="number"
              min="1"
              step="1"
              value={customMonths}
              onChange={(event) => setCustomMonths(event.target.value)}
              disabled={!canRenew}
            />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              className="btn secondary full-width"
              type="button"
              disabled={!canRenew}
              onClick={() => {
                const parsed = Number(customMonths);
                if (!Number.isInteger(parsed) || parsed < 1) {
                  setNotice("Enter a valid custom period in months.");
                  return;
                }
                setSelectedMonths(parsed);
                setNotice(`Preview updated for a ${parsed}-month rearm.`);
              }}
            >
              Rearm custom
            </button>
          </div>
        </div>

        <div className="detail-item">
          <div><strong>Current expiry:</strong> {formatDate(expiresAt)}</div>
          <div className="meta"><strong>Base date:</strong> {formatDate(baseDate)}</div>
          <div className="meta"><strong>Resulting expiry:</strong> {formatDate(resultingExpiry)}</div>
        </div>

        <PendingButton className="btn" type="submit" disabled={!canRenew} pendingLabel="Applying renewal...">
          Apply renewal
        </PendingButton>
        <ActionMessage state={renewalState} />
      </form>
    </div>
  );
}
