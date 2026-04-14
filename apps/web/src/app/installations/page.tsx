import Link from "next/link";
import { AdminShell } from "../components/AdminShell";
import { adminFetch } from "@/lib/admin";

export default async function InstallationsPage({ searchParams }: { searchParams?: { search?: string; licenseId?: string } }) {
  const params = new URLSearchParams();
  if (searchParams?.search) params.set("search", searchParams.search);
  if (searchParams?.licenseId) params.set("licenseId", searchParams.licenseId);

  const installations = await adminFetch<any[]>(`/admin/installations${params.toString() ? `?${params.toString()}` : ""}`);

  return (
    <AdminShell title="Installations" subtitle="Search the canonical installation records behind activation and refresh.">
      <div className="card">
        <h2>Search</h2>
        <form method="get" className="grid two">
          <input name="search" defaultValue={searchParams?.search || ""} placeholder="App ID, fingerprint, or license key" />
          <input name="licenseId" defaultValue={searchParams?.licenseId || ""} placeholder="License id" />
          <button className="btn secondary" type="submit">Filter</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Installation list</h2>
          <span className="muted">{installations.length} records</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>App ID</th>
                <th>Fingerprint</th>
                <th>License</th>
                <th>Status</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {installations.map((installation) => (
                <tr key={installation.id}>
                  <td>{installation.appId}</td>
                  <td>{installation.machineFingerprintHash}</td>
                  <td>{installation.license?.licenseKey || "-"}</td>
                  <td><span className="badge">{installation.status}</span></td>
                  <td>{new Date(installation.lastSeenAt).toLocaleString()}</td>
                  <td><Link className="btn secondary" href={`/installations/${installation.id}`}>Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
