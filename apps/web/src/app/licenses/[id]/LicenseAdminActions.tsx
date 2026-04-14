"use client";

import { useState } from "react";
import { cadenceSourceLabel, formatCadenceMonths } from "@/lib/cadence";

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
  return new Date(value).toLocaleString();
}

export function LicenseAdminActions({
  effectiveStatus,
  expiresAt,
  renewalCadenceMonths,
  renewalCadenceSource,
  planRenewalCadenceMonths,
  activationLink,
  activationToken,
  canRenew,
  renewAction
}: {
  effectiveStatus: string;
  expiresAt: string;
  renewalCadenceMonths: number;
  renewalCadenceSource: string;
  planRenewalCadenceMonths: number | null;
  activationLink: string;
  activationToken: string;
  canRenew: boolean;
  renewAction: (formData: FormData) => Promise<void>;
}) {
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [customMonths, setCustomMonths] = useState("1");
  const [notice, setNotice] = useState<string | null>(null);

  const baseDate = effectiveStatus === "EXPIRED" ? new Date() : new Date(expiresAt);
  const resultingExpiry = addMonthsUtc(baseDate, selectedMonths);

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

      <form action={renewAction} className="stack">
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

        <button className="btn" type="submit" disabled={!canRenew}>
          Apply renewal
        </button>
      </form>
    </div>
  );
}
