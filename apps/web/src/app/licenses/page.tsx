import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdminShell } from "../components/AdminShell";
import { adminFetch } from "@/lib/admin";

function parseJsonInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return {};
  return JSON.parse(value);
}

async function createLicenseAction(formData: FormData) {
  "use server";

  const created = await adminFetch<any>("/admin/licenses", {
    method: "POST",
    body: JSON.stringify({
      customerId: String(formData.get("customerId") || ""),
      productId: String(formData.get("productId") || ""),
      planId: String(formData.get("planId") || ""),
      status: String(formData.get("status") || "ACTIVE"),
      startsAt: String(formData.get("startsAt") || "") || undefined,
      expiresAt: String(formData.get("expiresAt") || ""),
      notes: String(formData.get("notes") || ""),
      overrides: parseJsonInput(formData.get("overrides"))
    })
  });

  revalidatePath("/licenses");
  redirect(`/licenses/${created.id}`);
}

export default async function LicensesPage({ searchParams }: { searchParams?: { search?: string; customerId?: string; productId?: string; status?: string } }) {
  const params = new URLSearchParams();
  if (searchParams?.search) params.set("search", searchParams.search);
  if (searchParams?.customerId) params.set("customerId", searchParams.customerId);
  if (searchParams?.productId) params.set("productId", searchParams.productId);
  if (searchParams?.status) params.set("status", searchParams.status);

  const [licenses, customers, products, plans] = await Promise.all([
    adminFetch<any[]>(`/admin/licenses${params.toString() ? `?${params.toString()}` : ""}`),
    adminFetch<any[]>("/admin/customers"),
    adminFetch<any[]>("/admin/products"),
    adminFetch<any[]>("/admin/license-plans")
  ]);

  return (
    <AdminShell title="Licenses" subtitle="Create and manage the canonical licensing records used by activation and refresh.">
      <div className="grid two">
        <div className="card">
          <h2>Filters</h2>
          <form method="get" className="stack">
            <input name="search" defaultValue={searchParams?.search || ""} placeholder="Search license key, customer, or product" />
            <select name="customerId" defaultValue={searchParams?.customerId || ""}>
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
            <select name="productId" defaultValue={searchParams?.productId || ""}>
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <select name="status" defaultValue={searchParams?.status || ""}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REVOKED">Revoked</option>
            </select>
            <button className="btn secondary" type="submit">Apply</button>
          </form>
        </div>

        <div className="card">
          <h2>New license</h2>
          <form action={createLicenseAction}>
            <label>
              Customer
              <select name="customerId" defaultValue="" required>
                <option value="" disabled>Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select name="productId" defaultValue="" required>
                <option value="" disabled>Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label>
              Plan
              <select name="planId" defaultValue="">
                <option value="">No plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.product?.name || "-"} / {plan.name}</option>
                ))}
              </select>
            </label>
            <div className="grid two">
              <label>
                Status
                <select name="status" defaultValue="ACTIVE">
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REVOKED">Revoked</option>
                </select>
              </label>
              <label>
                Starts at
                <input name="startsAt" type="datetime-local" />
              </label>
            </div>
            <label>
              Expires at
              <input name="expiresAt" type="datetime-local" required />
            </label>
            <label>
              Overrides JSON
              <textarea name="overrides" defaultValue={`{\n  "note": "optional overrides"\n}`} />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
            <button className="btn" type="submit">Create license</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>License list</h2>
          <span className="muted">{licenses.length} records</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>License key</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id}>
                  <td>{license.licenseKey}</td>
                  <td>{license.customer?.name || "-"}</td>
                  <td>{license.product?.code || "-"}</td>
                  <td>{license.plan?.name || "-"}</td>
                  <td><span className={`badge ${license.effectiveStatus === "ACTIVE" ? "success" : license.effectiveStatus === "EXPIRED" ? "warning" : "danger"}`}>{license.effectiveStatus}</span></td>
                  <td>{new Date(license.expiresAt).toLocaleDateString()}</td>
                  <td><Link className="btn secondary" href={`/licenses/${license.id}`}>Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
