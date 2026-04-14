import Link from "next/link";
import { AdminShell } from "../components/AdminShell";
import { adminFetch } from "@/lib/admin";

export default async function AuditEventsPage({ searchParams }: { searchParams?: { search?: string; licenseId?: string; customerId?: string; eventType?: string; from?: string; to?: string } }) {
  const params = new URLSearchParams();
  if (searchParams?.search) params.set("search", searchParams.search);
  if (searchParams?.licenseId) params.set("licenseId", searchParams.licenseId);
  if (searchParams?.customerId) params.set("customerId", searchParams.customerId);
  if (searchParams?.eventType) params.set("eventType", searchParams.eventType);
  if (searchParams?.from) params.set("from", searchParams.from);
  if (searchParams?.to) params.set("to", searchParams.to);

  const events = await adminFetch<any[]>(`/admin/audit-events${params.toString() ? `?${params.toString()}` : ""}`);

  return (
    <AdminShell title="Audit Events" subtitle="Read-only event history for support and operational review.">
      <div className="card">
        <h2>Search</h2>
        <form method="get" className="grid two">
          <input name="search" defaultValue={searchParams?.search || ""} placeholder="License key, actor, or event type" />
          <input name="eventType" defaultValue={searchParams?.eventType || ""} placeholder="Event type" />
          <input name="from" type="date" defaultValue={searchParams?.from || ""} />
          <input name="to" type="date" defaultValue={searchParams?.to || ""} />
          <button className="btn secondary" type="submit">Filter</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Event list</h2>
          <span className="muted">{events.length} records</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>License</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.eventType}</td>
                  <td>{event.license?.licenseKey || "-"}</td>
                  <td>{event.customer?.name || "-"}</td>
                  <td>{event.product?.code || "-"}</td>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td><Link className="btn secondary" href={`/audit-events/${event.id}`}>Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
