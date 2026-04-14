import Link from "next/link";
import { AdminShell } from "../components/AdminShell";
import { adminFetch } from "@/lib/admin";

function statusClass(status?: string) {
  if (!status) return "badge";
  if (status === "ACTIVE") return "badge success";
  if (status === "EXPIRED") return "badge warning";
  if (status === "REVOKED" || status === "BLOCKED") return "badge danger";
  return "badge";
}

function effectiveLicenseStatus(license?: { status?: string; expiresAt?: string }) {
  if (!license) return "N/A";
  if (license.status !== "ACTIVE" || !license.expiresAt) return license.status || "N/A";
  return new Date(license.expiresAt).getTime() < Date.now() ? "EXPIRED" : "ACTIVE";
}

export default async function DashboardPage() {
  const summary = await adminFetch<any>("/admin/dashboard");

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Operational overview of customers, licenses, activations, and audit history."
    >
      <div className="grid three">
        <div className="card stat">
          <span className="muted">Customers</span>
          <span className="value">{summary.totalCustomers}</span>
        </div>
        <div className="card stat">
          <span className="muted">Active licenses</span>
          <span className="value">{summary.totalActiveLicenses}</span>
        </div>
        <div className="card stat">
          <span className="muted">Expired / revoked</span>
          <span className="value">{summary.totalExpiredLicenses + summary.totalRevokedLicenses}</span>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Recent activations</h2>
          <div className="detail-list">
            {summary.recentActivations.map((event: any) => (
              <div className="detail-item" key={event.id}>
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>{event.license?.licenseKey || "Unknown license"}</strong>
                  <span className={statusClass(effectiveLicenseStatus(event.license))}>{effectiveLicenseStatus(event.license)}</span>
                </div>
                <div className="meta">
                  {event.license?.customer?.name || "-"} · {event.installation?.appId || "-"} ·{" "}
                  {new Date(event.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Recent refresh and audit events</h2>
          <div className="detail-list">
            {summary.recentRefresh.map((event: any) => (
              <div className="detail-item" key={event.id}>
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>Refresh</strong>
                  <span className="badge">{new Date(event.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="meta">{event.license?.licenseKey || "Unknown license"} · {event.installation?.appId || "-"}</div>
              </div>
            ))}
            {summary.recentAuditEvents.slice(0, 3).map((event: any) => (
              <div className="detail-item" key={event.id}>
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>{event.eventType}</strong>
                  <span className="badge">{new Date(event.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="meta">{event.license?.licenseKey || event.customer?.name || event.product?.code || "-"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Quick links</h2>
          <div className="actions">
            <Link className="btn secondary" href="/customers">Customers</Link>
            <Link className="btn secondary" href="/products">Products</Link>
            <Link className="btn secondary" href="/license-plans">License plans</Link>
            <Link className="btn secondary" href="/licenses">Licenses</Link>
          </div>
        </div>

        <div className="card">
          <h2>State checks</h2>
          <div className="detail-list">
            <div className="detail-item">Admin auth is required before any data is shown.</div>
            <div className="detail-item">This UI reads the same API data used by activation and refresh flows.</div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
