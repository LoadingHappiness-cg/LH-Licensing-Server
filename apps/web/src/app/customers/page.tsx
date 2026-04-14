import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminShell } from "../components/AdminShell";
import { adminFetch } from "@/lib/admin";

async function createCustomerAction(formData: FormData) {
  "use server";

  await adminFetch("/admin/customers", {
    method: "POST",
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
}

export default async function CustomersPage({ searchParams }: { searchParams?: { search?: string } }) {
  const search = searchParams?.search || "";
  const customers = await adminFetch<any[]>(`/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`);

  return (
    <AdminShell title="Customers" subtitle="Create and manage customer accounts for licensed deployments.">
      <div className="grid two">
        <div className="card">
          <h2>Search</h2>
          <form method="get" className="search-row">
            <input name="search" defaultValue={search} placeholder="Search by code, name, or email" />
            <button className="btn secondary" type="submit">Search</button>
          </form>
        </div>

        <div className="card">
          <h2>New customer</h2>
          <form action={createCustomerAction}>
            <label>
              Code
              <input name="code" placeholder="ACME_CORP" />
            </label>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" />
            </label>
            <label>
              Phone
              <input name="phone" />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
            <label className="actions">
              <input name="isActive" type="checkbox" defaultChecked /> Active
            </label>
            <button className="btn" type="submit">Create customer</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Customer list</h2>
          <span className="muted">{customers.length} records</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Licenses</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.code}</td>
                  <td>{customer.name}</td>
                  <td>{customer.email || customer.phone || "-"}</td>
                  <td>
                    <span className={`badge ${customer.isActive ? "success" : "danger"}`}>{customer.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td>{customer.licenses?.length || 0}</td>
                  <td>
                    <Link className="btn secondary" href={`/customers/${customer.id}`}>Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
