import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "../../components/AdminShell";
import { adminFetch } from "@/lib/admin";

function currentLicenseStatus(license: { status: string; expiresAt: string }) {
  if (license.status !== "ACTIVE") return license.status;
  return new Date(license.expiresAt).getTime() < Date.now() ? "EXPIRED" : "ACTIVE";
}

function parseJsonInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return {};
  return JSON.parse(value);
}

async function updatePlanAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  await adminFetch(`/admin/license-plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      productId: String(formData.get("productId") || ""),
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      durationDays: String(formData.get("durationDays") || "") || undefined,
      maxCompanies: String(formData.get("maxCompanies") || "") || undefined,
      maxWorkstations: String(formData.get("maxWorkstations") || "") || undefined,
      entitlements: parseJsonInput(formData.get("entitlements")),
      notes: String(formData.get("notes") || ""),
      isActive: formData.get("isActive") === "on"
    })
  });

  revalidatePath("/license-plans");
  revalidatePath(`/license-plans/${id}`);
}

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const [plan, products] = await Promise.all([
    adminFetch<any>(`/admin/license-plans/${params.id}`).catch(() => null),
    adminFetch<any[]>("/admin/products")
  ]);

  if (!plan) {
    notFound();
  }

  return (
    <AdminShell title={plan.name} subtitle="Plan details, entitlements, and linked licenses.">
      <div className="page-actions" style={{ marginBottom: 16 }}>
        <Link className="btn secondary" href="/license-plans">Back</Link>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Edit plan</h2>
          <form action={updatePlanAction}>
            <input type="hidden" name="id" value={plan.id} />
            <label>
              Product
              <select name="productId" defaultValue={plan.productId} required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label>
              Code
              <input name="code" defaultValue={plan.code} required />
            </label>
            <label>
              Name
              <input name="name" defaultValue={plan.name} required />
            </label>
            <div className="grid two">
              <label>
                Duration days
                <input name="durationDays" type="number" min="1" defaultValue={plan.durationDays || ""} />
              </label>
              <label>
                Max companies
                <input name="maxCompanies" type="number" min="1" defaultValue={plan.maxCompanies || ""} />
              </label>
            </div>
            <label>
              Max workstations
              <input name="maxWorkstations" type="number" min="1" defaultValue={plan.maxWorkstations || ""} />
            </label>
            <label>
              Entitlements JSON
              <textarea name="entitlements" defaultValue={JSON.stringify(plan.entitlements || {}, null, 2)} />
            </label>
            <label>
              Notes
              <textarea name="notes" defaultValue={plan.notes || ""} />
            </label>
            <label className="actions">
              <input name="isActive" type="checkbox" defaultChecked={plan.isActive} /> Active
            </label>
            <button className="btn" type="submit">Save plan</button>
          </form>
        </div>

        <div className="card">
          <h2>Summary</h2>
          <div className="detail-list">
            <div className="detail-item"><strong>Product:</strong> {plan.product?.name || "-"}</div>
            <div className="detail-item"><strong>Code:</strong> {plan.code}</div>
            <div className="detail-item"><strong>Status:</strong> {plan.isActive ? "Active" : "Inactive"}</div>
            <div className="detail-item"><strong>Duration:</strong> {plan.durationDays || "-"}</div>
            <div className="detail-item"><strong>Entitlements:</strong> <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(plan.entitlements || {}, null, 2)}</pre></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Linked licenses</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plan.licenses.map((license: any) => (
                <tr key={license.id}>
                  <td>{license.licenseKey}</td>
                  <td>{license.customer?.name || "-"}</td>
                  <td><span className="badge">{currentLicenseStatus(license)}</span></td>
                  <td>{new Date(license.expiresAt).toLocaleDateString()}</td>
                  <td><Link className="btn secondary" href={`/licenses/${license.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
