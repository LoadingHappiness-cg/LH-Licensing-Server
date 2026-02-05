import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

async function createLicenseAction(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/api/auth/signin");
  }

  const payload = {
    customerName: String(formData.get("customerName") || ""),
    customerEmail: String(formData.get("customerEmail") || ""),
    planName: String(formData.get("planName") || "Standard"),
    maxCompanies: Number(formData.get("maxCompanies") || 1),
    maxWorkstations: Number(formData.get("maxWorkstations") || 1)
  };

  await apiFetch("/admin/licenses", session.accessToken, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  redirect("/licenses");
}

export default async function LicensesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/api/auth/signin");
  }

  const licenses = await apiFetch<any[]>("/admin/licenses", session.accessToken);

  return (
    <div className="container">
      <div className="header">
        <h1>Licenses</h1>
        <a className="btn secondary" href="/api/auth/signout">Sign out</a>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Create License</h2>
          <form action={createLicenseAction}>
            <label>
              Customer name
              <input name="customerName" required />
            </label>
            <label>
              Customer email
              <input name="customerEmail" type="email" />
            </label>
            <label>
              Plan
              <select name="planName" defaultValue="Standard">
                <option>Standard</option>
                <option>Professional</option>
                <option>Enterprise</option>
              </select>
            </label>
            <label>
              Max companies
              <input name="maxCompanies" type="number" defaultValue="1" min="1" />
            </label>
            <label>
              Max workstations
              <input name="maxWorkstations" type="number" defaultValue="1" min="1" />
            </label>
            <button className="btn" type="submit">Create</button>
          </form>
        </div>

        <div className="card">
          <h2>Existing licenses</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id}>
                  <td>{l.customer?.name || "-"}</td>
                  <td>{l.planName}</td>
                  <td><span className="badge">{l.status}</span></td>
                  <td>{new Date(l.expiresAt).toLocaleDateString()}</td>
                  <td><a className="btn secondary" href={`/licenses/${l.id}`}>View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
