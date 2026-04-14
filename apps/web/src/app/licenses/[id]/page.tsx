import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdminShell } from "../../components/AdminShell";
import { adminFetch } from "@/lib/admin";
import { webConfig } from "@/lib/config";
import { cadenceSnapshotLabel, formatCadenceMonths } from "@/lib/cadence";
import { LicenseAdminActions } from "./LicenseAdminActions";

function parseJsonInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return {};
  return JSON.parse(value);
}

function currentLicenseStatus(license: { status: string; expiresAt: string }) {
  if (license.status !== "ACTIVE") return license.status;
  return new Date(license.expiresAt).getTime() < Date.now() ? "EXPIRED" : "ACTIVE";
}

async function updateLicenseAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  await adminFetch(`/admin/licenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      customerId: String(formData.get("customerId") || ""),
      productId: String(formData.get("productId") || ""),
      planId: String(formData.get("planId") || ""),
      startsAt: String(formData.get("startsAt") || "") || undefined,
      expiresAt: String(formData.get("expiresAt") || "") || undefined,
      notes: String(formData.get("notes") || ""),
      overrides: parseJsonInput(formData.get("overrides"))
    })
  });

  revalidatePath("/licenses");
  revalidatePath(`/licenses/${id}`);
}

async function mutateLicenseAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  const action = String(formData.get("action") || "");
  if (!id || !action) return;

  if (action === "extend") {
    const expiresAt = String(formData.get("expiresAt") || "");
    await adminFetch(`/admin/licenses/${id}/extend`, {
      method: "POST",
      body: JSON.stringify({ expiresAt })
    });
  } else if (action === "revoke") {
    await adminFetch(`/admin/licenses/${id}/revoke`, { method: "POST" });
  } else if (action === "suspend") {
    await adminFetch(`/admin/licenses/${id}/suspend`, { method: "POST" });
  } else if (action === "reactivate") {
    await adminFetch(`/admin/licenses/${id}/reactivate`, { method: "POST" });
  } else if (action === "activation-link") {
    const token = await adminFetch<{ activationToken: string }>(`/admin/licenses/${id}/activation-link`, {
      method: "POST"
    });
    redirect(`/licenses/${id}?activationToken=${encodeURIComponent(token.activationToken)}`);
  }

  revalidatePath("/licenses");
  revalidatePath(`/licenses/${id}`);
}

async function rearmLicenseAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  const months = Number(formData.get("months") || 0);
  if (!id || !Number.isInteger(months) || months < 1) return;

  await adminFetch(`/admin/licenses/${id}/rearm`, {
    method: "POST",
    body: JSON.stringify({ months })
  });

  revalidatePath("/licenses");
  revalidatePath(`/licenses/${id}`);
}

export default async function LicenseDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { activationToken?: string } }) {
  const [license, customers, products, plans] = await Promise.all([
    adminFetch<any>(`/admin/licenses/${params.id}`).catch(() => null),
    adminFetch<any[]>("/admin/customers"),
    adminFetch<any[]>("/admin/products"),
    adminFetch<any[]>("/admin/license-plans")
  ]);

  if (!license) {
    notFound();
  }

  const activationToken = searchParams?.activationToken || license.activationTokens?.[0]?.token || "";
  const activationLink = activationToken ? `${webConfig.siteUrl}/licenses/${license.id}?activationToken=${encodeURIComponent(activationToken)}` : "";
  const effectiveStatus = currentLicenseStatus(license);

  return (
    <AdminShell title={license.licenseKey} subtitle="Full license record with linked installations, activations, and audit events.">
      <div className="page-actions" style={{ marginBottom: 16 }}>
        <Link className="btn secondary" href="/licenses">Back</Link>
        {currentLicenseStatus(license) === "ACTIVE" ? (
          <form action={mutateLicenseAction}>
            <input type="hidden" name="id" value={license.id} />
            <input type="hidden" name="action" value="activation-link" />
            <button className="btn secondary" type="submit">Generate activation link</button>
          </form>
        ) : null}
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Edit license</h2>
          <form action={updateLicenseAction}>
            <input type="hidden" name="id" value={license.id} />
            <label>
              Customer
              <select name="customerId" defaultValue={license.customerId || ""} required>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select name="productId" defaultValue={license.productId} required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label>
              Plan
              <select name="planId" defaultValue={license.planId || ""}>
                <option value="">No plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.product?.name || "-"} / {plan.name}</option>
                ))}
              </select>
            </label>
            <div className="grid two">
              <label>
                Starts at
                <input name="startsAt" type="datetime-local" defaultValue={license.startsAt ? new Date(license.startsAt).toISOString().slice(0, 16) : ""} />
              </label>
              <label>
                Expires at
                <input name="expiresAt" type="datetime-local" defaultValue={license.expiresAt ? new Date(license.expiresAt).toISOString().slice(0, 16) : ""} />
              </label>
            </div>
            <label>
              Overrides JSON
              <textarea name="overrides" defaultValue={JSON.stringify(license.overrides || {}, null, 2)} />
            </label>
            <label>
              Notes
              <textarea name="notes" defaultValue={license.notes || ""} />
            </label>
            <button className="btn" type="submit">Save license</button>
          </form>
        </div>

        <div className="card">
          <h2>Lifecycle actions</h2>
          <form action={mutateLicenseAction} className="stack">
            <input type="hidden" name="id" value={license.id} />
            <div className="actions">
              <button className="btn danger" type="submit" name="action" value="revoke">Revoke</button>
              <button className="btn secondary" type="submit" name="action" value="suspend">Suspend</button>
              <button className="btn secondary" type="submit" name="action" value="reactivate">Reactivate</button>
            </div>
            <label>
              Extend expiry
              <input name="expiresAt" type="datetime-local" />
            </label>
            <button className="btn secondary" type="submit" name="action" value="extend">Extend</button>
          </form>

          <div style={{ marginTop: 20 }}>
            <h3>Activation link and renewal</h3>
            <LicenseAdminActions
              effectiveStatus={effectiveStatus}
              expiresAt={license.expiresAt}
              activationLink={activationLink}
              activationToken={activationToken}
              canRenew={effectiveStatus !== "REVOKED"}
              renewAction={rearmLicenseAction}
            />
          </div>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Summary</h2>
          <div className="detail-list">
            <div className="detail-item"><strong>Customer:</strong> {license.customer?.name || "-"}</div>
            <div className="detail-item"><strong>Product:</strong> {license.product?.code || "-"}</div>
            <div className="detail-item"><strong>Plan:</strong> {license.plan?.name || "-"}</div>
            <div className="detail-item"><strong>Status:</strong> <span className="badge">{effectiveStatus}</span></div>
            <div className="detail-item"><strong>Renewal cadence:</strong> {formatCadenceMonths(license.renewalCadenceMonths)}</div>
            <div className="detail-item"><strong>Cadence source:</strong> {cadenceSnapshotLabel(license.renewalCadenceSource)}</div>
            <div className="detail-item"><strong>Plan cadence:</strong> {license.plan ? formatCadenceMonths(license.plan.renewalCadenceMonths) : "-"}</div>
            <div className="detail-item"><strong>Starts:</strong> {new Date(license.startsAt).toLocaleString()}</div>
            <div className="detail-item"><strong>Expires:</strong> {new Date(license.expiresAt).toLocaleString()}</div>
            <div className="detail-item"><strong>Notes:</strong> {license.notes || "-"}</div>
          </div>
        </div>

        <div className="card">
          <h2>Linked installations</h2>
          <div className="detail-list">
            {license.activations.map((activation: any) => (
              <div className="detail-item" key={activation.id}>
                <strong>{activation.installation?.appId || "-"}</strong>
                <div className="meta">
                  {activation.installation?.machineFingerprintHash || "-"} · {activation.clientVersion || "-"}
                </div>
                <div className="meta">Activated {new Date(activation.activatedAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Activation tokens</h2>
        <div className="detail-list">
          {license.activationTokens.map((token: any) => (
            <div className="detail-item" key={token.id}>
              <strong>{token.token}</strong>
              <div className="meta">Created {new Date(token.createdAt).toLocaleString()}</div>
              <div className="meta">Last used {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "-"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Audit events</h2>
        <div className="detail-list">
          {license.events.map((event: any) => (
            <div className="detail-item" key={event.id}>
              <strong>{event.eventType}</strong>
              <div className="meta">{new Date(event.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
