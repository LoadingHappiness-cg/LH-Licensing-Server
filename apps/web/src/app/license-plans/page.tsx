import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminShell } from "../components/AdminShell";
import { adminFetch } from "@/lib/admin";
import { formatCadenceMonths } from "@/lib/cadence";

function parseJsonInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return {};
  return JSON.parse(value);
}

async function createPlanAction(formData: FormData) {
  "use server";

  await adminFetch("/admin/license-plans", {
    method: "POST",
    body: JSON.stringify({
      productId: String(formData.get("productId") || ""),
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      durationDays: String(formData.get("durationDays") || "") || undefined,
      renewalCadenceMonths: String(formData.get("renewalCadenceMonths") || "") || undefined,
      maxCompanies: String(formData.get("maxCompanies") || "") || undefined,
      maxWorkstations: String(formData.get("maxWorkstations") || "") || undefined,
      entitlements: parseJsonInput(formData.get("entitlements")),
      notes: String(formData.get("notes") || ""),
      isActive: formData.get("isActive") === "on"
    })
  });

  revalidatePath("/license-plans");
}

export default async function LicensePlansPage({ searchParams }: { searchParams?: { search?: string; productId?: string } }) {
  const search = searchParams?.search || "";
  const productId = searchParams?.productId || "";
  const [plans, products] = await Promise.all([
    adminFetch<any[]>(`/admin/license-plans?${new URLSearchParams({ ...(search ? { search } : {}), ...(productId ? { productId } : {}) }).toString()}`),
    adminFetch<any[]>("/admin/products")
  ]);

  return (
    <AdminShell title="License Plans" subtitle="Define entitlement bundles and limits for each product.">
      <div className="grid two">
        <div className="card">
          <h2>Search</h2>
          <form method="get" className="stack">
            <input name="search" defaultValue={search} placeholder="Search by code or name" />
            <select name="productId" defaultValue={productId}>
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <button className="btn secondary" type="submit">Filter</button>
          </form>
        </div>

        <div className="card">
          <h2>New plan</h2>
          <form action={createPlanAction}>
            <label>
              Product
              <select name="productId" required defaultValue="">
                <option value="" disabled>Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label>
              Code
              <input name="code" placeholder="BASIC_LOCAL" required />
            </label>
            <label>
              Name
              <input name="name" required />
            </label>
            <div className="grid two">
              <label>
                Duration days
                <input name="durationDays" type="number" min="1" />
              </label>
              <label>
                Renewal cadence months
                <input name="renewalCadenceMonths" type="number" min="1" placeholder="1 = monthly" />
              </label>
            </div>
            <div className="grid two">
              <label>
                Max companies
                <input name="maxCompanies" type="number" min="1" />
              </label>
              <label>
                Max workstations
                <input name="maxWorkstations" type="number" min="1" />
              </label>
            </div>
            <label>
              Entitlements JSON
              <textarea name="entitlements" defaultValue={`{\n  "printing": true,\n  "refresh": true\n}`} />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
            <label className="actions">
              <input name="isActive" type="checkbox" defaultChecked /> Active
            </label>
            <button className="btn" type="submit">Create plan</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Plan list</h2>
          <span className="muted">{plans.length} records</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Renewal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.product?.name || "-"}</td>
                  <td>{plan.code}</td>
                  <td>{plan.name}</td>
                  <td><span className={`badge ${plan.isActive ? "success" : "danger"}`}>{plan.isActive ? "Active" : "Inactive"}</span></td>
                  <td>{plan.durationDays || "-"}</td>
                  <td>{formatCadenceMonths(plan.renewalCadenceMonths)}</td>
                  <td><Link className="btn secondary" href={`/license-plans/${plan.id}`}>Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
