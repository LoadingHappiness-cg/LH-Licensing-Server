import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdminShell } from "../../components/AdminShell";
import { adminFetch } from "@/lib/admin";
import { InstallationAdminActions } from "./InstallationAdminActions";

async function blockInstallationAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  await adminFetch(`/admin/installations/${id}/block`, { method: "POST" });
  revalidatePath("/installations");
  revalidatePath(`/installations/${id}`);
}

async function unblockInstallationAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  await adminFetch(`/admin/installations/${id}/unblock`, { method: "POST" });
  revalidatePath("/installations");
  revalidatePath(`/installations/${id}`);
}

async function releaseInstallationAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  await adminFetch(`/admin/installations/${id}/release`, { method: "POST" });
  revalidatePath("/installations");
  revalidatePath(`/installations/${id}`);
}

export default async function InstallationDetailPage({ params }: { params: { id: string } }) {
  const installation = await adminFetch<any>(`/admin/installations/${params.id}`).catch(() => null);
  if (!installation) {
    notFound();
  }

  return (
    <AdminShell title={installation.appId} subtitle="Installation details, activations, and audit history.">
      <div className="page-actions" style={{ marginBottom: 16 }}>
        <Link className="btn secondary" href="/installations">Back</Link>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Summary</h2>
          <div className="detail-list">
            <div className="detail-item"><strong>App ID:</strong> {installation.appId}</div>
            <div className="detail-item"><strong>Fingerprint:</strong> {installation.machineFingerprintHash}</div>
            <div className="detail-item"><strong>Device:</strong> {installation.deviceName || "-"}</div>
            <div className="detail-item"><strong>OS Info:</strong> {installation.osInfo || "-"}</div>
            <div className="detail-item"><strong>License:</strong> {installation.license?.licenseKey || "-"}</div>
            <div className="detail-item"><strong>Bound license state:</strong> {installation.license?.status || "-"}</div>
            <div className="detail-item"><strong>Status:</strong> {installation.status}</div>
            <div className="detail-item"><strong>First seen:</strong> {new Date(installation.firstSeenAt).toLocaleString()}</div>
            <div className="detail-item"><strong>Last seen:</strong> {new Date(installation.lastSeenAt).toLocaleString()}</div>
          </div>

          <InstallationAdminActions
            status={installation.status}
            licenseStatus={installation.license?.status || null}
            installationId={installation.id}
            blockAction={blockInstallationAction}
            unblockAction={unblockInstallationAction}
            releaseAction={releaseInstallationAction}
          />
        </div>

        <div className="card">
          <h2>Activations</h2>
          <div className="detail-list">
            {installation.activations.map((activation: any) => (
              <div className="detail-item" key={activation.id}>
                <strong>{activation.clientVersion || "Activation"}</strong>
                <div className="meta">Activated {new Date(activation.activatedAt).toLocaleString()}</div>
                <div className="meta">Expires {activation.expiresAt ? new Date(activation.expiresAt).toLocaleString() : "-"}</div>
                <div className="meta">Refresh token hash {activation.refreshTokenHash || "-"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Audit events</h2>
        <div className="detail-list">
          {installation.auditEvents.map((event: any) => (
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
