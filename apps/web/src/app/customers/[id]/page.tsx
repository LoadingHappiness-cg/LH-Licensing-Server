import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "../../components/AdminShell";
import { adminFetch } from "@/lib/admin";

function currentLicenseStatus(license: { status: string; expiresAt: string }) {
  if (license.status !== "ACTIVE") return license.status;
  return new Date(license.expiresAt).getTime() < Date.now() ? "EXPIRED" : "ACTIVE";
}

async function updateCustomerAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  await adminFetch(`/admin/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      notes: String(formData.get("notes") || ""),
      isActive: formData.get("isActive") === "on"
    })
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await adminFetch<any>(`/admin/customers/${params.id}`).catch(() => null);
  if (!customer) {
    notFound();
  }

  return (
    <AdminShell title={customer.name} subtitle="Customer details, related licenses, and audit trail.">
      <div className="page-actions" style={{ marginBottom: 16 }}>
        <Link className="btn secondary" href="/customers">Back</Link>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Edit customer</h2>
          <form action={updateCustomerAction}>
            <input type="hidden" name="id" value={customer.id} />
            <label>
              Code
              <input name="code" defaultValue={customer.code} />
            </label>
            <label>
              Name
              <input name="name" defaultValue={customer.name} required />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={customer.email || ""} />
            </label>
            <label>
              Phone
              <input name="phone" defaultValue={customer.phone || ""} />
            </label>
            <label>
              Notes
              <textarea name="notes" defaultValue={customer.notes || ""} />
            </label>
            <label className="actions">
              <input name="isActive" type="checkbox" defaultChecked={customer.isActive} /> Active
            </label>
            <button className="btn" type="submit">Save customer</button>
          </form>
        </div>

        <div className="card">
          <h2>Summary</h2>
          <div className="detail-list">
            <div className="detail-item"><strong>Code:</strong> {customer.code}</div>
            <div className="detail-item"><strong>Status:</strong> {customer.isActive ? "Active" : "Inactive"}</div>
            <div className="detail-item"><strong>Email:</strong> {customer.email || "-"}</div>
            <div className="detail-item"><strong>Phone:</strong> {customer.phone || "-"}</div>
            <div className="detail-item"><strong>Notes:</strong> {customer.notes || "-"}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Licenses</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Product</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customer.licenses.map((license: any) => (
                <tr key={license.id}>
                  <td>{license.licenseKey}</td>
                  <td>{license.product?.code || "-"}</td>
                  <td>{license.plan?.name || "-"}</td>
                  <td><span className="badge">{currentLicenseStatus(license)}</span></td>
                  <td>{new Date(license.expiresAt).toLocaleDateString()}</td>
                  <td><Link className="btn secondary" href={`/licenses/${license.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent audit events</h2>
        <div className="detail-list">
          {customer.auditEvents.map((event: any) => (
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
