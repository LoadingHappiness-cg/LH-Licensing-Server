import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "../../components/AdminShell";
import { adminFetch } from "@/lib/admin";

export default async function AuditEventDetailPage({ params }: { params: { id: string } }) {
  const event = await adminFetch<any>(`/admin/audit-events/${params.id}`).catch(() => null);
  if (!event) {
    notFound();
  }

  return (
    <AdminShell title={event.eventType} subtitle="Audit event details and payload.">
      <div className="page-actions" style={{ marginBottom: 16 }}>
        <Link className="btn secondary" href="/audit-events">Back</Link>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Summary</h2>
          <div className="detail-list">
            <div className="detail-item"><strong>Type:</strong> {event.eventType}</div>
            <div className="detail-item"><strong>Customer:</strong> {event.customer?.name || "-"}</div>
            <div className="detail-item"><strong>Product:</strong> {event.product?.code || "-"}</div>
            <div className="detail-item"><strong>License:</strong> {event.license?.licenseKey || "-"}</div>
            <div className="detail-item"><strong>Installation:</strong> {event.installation?.appId || "-"}</div>
            <div className="detail-item"><strong>Actor type:</strong> {event.actorType || "-"}</div>
            <div className="detail-item"><strong>Actor id:</strong> {event.actorId || "-"}</div>
            <div className="detail-item"><strong>Created at:</strong> {new Date(event.createdAt).toLocaleString()}</div>
          </div>
        </div>

        <div className="card">
          <h2>Payload</h2>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(event.payload || {}, null, 2)}</pre>
        </div>
      </div>
    </AdminShell>
  );
}
