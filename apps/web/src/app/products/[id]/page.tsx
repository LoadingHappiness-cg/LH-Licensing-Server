import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "../../components/AdminShell";
import { adminFetch } from "@/lib/admin";

function currentLicenseStatus(license: { status: string; expiresAt: string }) {
  if (license.status !== "ACTIVE") return license.status;
  return new Date(license.expiresAt).getTime() < Date.now() ? "EXPIRED" : "ACTIVE";
}

async function updateProductAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  await adminFetch(`/admin/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      notes: String(formData.get("notes") || ""),
      isActive: formData.get("isActive") === "on"
    })
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await adminFetch<any>(`/admin/products/${params.id}`).catch(() => null);
  if (!product) {
    notFound();
  }

  return (
    <AdminShell title={product.name} subtitle="Product details, plans, licenses, and installations.">
      <div className="page-actions" style={{ marginBottom: 16 }}>
        <Link className="btn secondary" href="/products">Back</Link>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Edit product</h2>
          <form action={updateProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <label>
              Code
              <input name="code" defaultValue={product.code} />
            </label>
            <label>
              Name
              <input name="name" defaultValue={product.name} required />
            </label>
            <label>
              Notes
              <textarea name="notes" defaultValue={product.notes || ""} />
            </label>
            <label className="actions">
              <input name="isActive" type="checkbox" defaultChecked={product.isActive} /> Active
            </label>
            <button className="btn" type="submit">Save product</button>
          </form>
        </div>

        <div className="card">
          <h2>Summary</h2>
          <div className="detail-list">
            <div className="detail-item"><strong>Code:</strong> {product.code}</div>
            <div className="detail-item"><strong>Status:</strong> {product.isActive ? "Active" : "Inactive"}</div>
            <div className="detail-item"><strong>Notes:</strong> {product.notes || "-"}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Plans</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {product.plans.map((plan: any) => (
                <tr key={plan.id}>
                  <td>{plan.code}</td>
                  <td>{plan.name}</td>
                  <td><span className={`badge ${plan.isActive ? "success" : "danger"}`}>{plan.isActive ? "Active" : "Inactive"}</span></td>
                  <td><Link className="btn secondary" href={`/license-plans/${plan.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Recent licenses</h2>
          <div className="detail-list">
              {product.licenses.map((license: any) => (
                <div className="detail-item" key={license.id}>
                  <div className="actions" style={{ justifyContent: "space-between" }}>
                    <strong>{license.licenseKey}</strong>
                    <span className="badge">{currentLicenseStatus(license)}</span>
                  </div>
                <div className="meta">{license.customer?.name || "-"} · {new Date(license.expiresAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Recent installations</h2>
          <div className="detail-list">
            {product.installations.map((installation: any) => (
              <div className="detail-item" key={installation.id}>
                <strong>{installation.appId}</strong>
                <div className="meta">{installation.machineFingerprintHash.slice(0, 12)} · {installation.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
