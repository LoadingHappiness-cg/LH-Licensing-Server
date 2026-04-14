import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminShell } from "../components/AdminShell";
import { adminFetch } from "@/lib/admin";

async function createProductAction(formData: FormData) {
  "use server";

  await adminFetch("/admin/products", {
    method: "POST",
    body: JSON.stringify({
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      notes: String(formData.get("notes") || ""),
      isActive: formData.get("isActive") === "on"
    })
  });

  revalidatePath("/products");
}

export default async function ProductsPage({ searchParams }: { searchParams?: { search?: string } }) {
  const search = searchParams?.search || "";
  const products = await adminFetch<any[]>(`/admin/products${search ? `?search=${encodeURIComponent(search)}` : ""}`);

  return (
    <AdminShell title="Products" subtitle="Register licensed products and keep the canonical product code stable.">
      <div className="grid two">
        <div className="card">
          <h2>Search</h2>
          <form method="get" className="search-row">
            <input name="search" defaultValue={search} placeholder="Search by code or name" />
            <button className="btn secondary" type="submit">Search</button>
          </form>
        </div>

        <div className="card">
          <h2>New product</h2>
          <form action={createProductAction}>
            <label>
              Code
              <input name="code" placeholder="ETIQUETAS_GS1" />
            </label>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
            <label className="actions">
              <input name="isActive" type="checkbox" defaultChecked /> Active
            </label>
            <button className="btn" type="submit">Create product</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Product list</h2>
          <span className="muted">{products.length} records</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Plans</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.code}</td>
                  <td>{product.name}</td>
                  <td>
                    <span className={`badge ${product.isActive ? "success" : "danger"}`}>{product.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td>{product.plans?.length || 0}</td>
                  <td>
                    <Link className="btn secondary" href={`/products/${product.id}`}>Details</Link>
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
