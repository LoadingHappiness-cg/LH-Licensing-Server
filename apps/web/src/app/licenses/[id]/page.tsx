import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

async function generateLinkAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/api/auth/signin");
  }

  await apiFetch(`/admin/licenses/${id}/activation-link`, session.accessToken, {
    method: "POST"
  });

  revalidatePath(`/licenses/${id}`);
}

export default async function LicenseDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/api/auth/signin");
  }

  const license = await apiFetch<any>(`/admin/licenses/${params.id}`, session.accessToken);
  const tokens = (license.activationTokens || []).slice().sort((a: any, b: any) => {
    const aDate = new Date(a.createdAt).getTime();
    const bDate = new Date(b.createdAt).getTime();
    return bDate - aDate;
  });
  const latest = tokens[0];
  const baseUrl = process.env.NEXTAUTH_URL || "https://license.loadinghappiness.pt";
  const activationLink = latest ? `${baseUrl}/activate/${latest.token}` : "No activation link yet";

  return (
    <div className="container">
      <div className="header">
        <h1>License details</h1>
        <a className="btn secondary" href="/licenses">Back</a>
      </div>

      <div className="card">
        <p><strong>Customer:</strong> {license.customer?.name || "-"}</p>
        <p><strong>Plan:</strong> {license.planName}</p>
        <p><strong>Max companies:</strong> {license.maxCompanies}</p>
        <p><strong>Max workstations:</strong> {license.maxWorkstations}</p>
        <p><strong>Status:</strong> {license.status}</p>
        <p><strong>Expires:</strong> {new Date(license.expiresAt).toLocaleDateString()}</p>
        <p><strong>Activation link:</strong> {activationLink}</p>
        <form action={generateLinkAction}>
          <input type="hidden" name="id" value={license.id} />
          <button className="btn" type="submit">Generate new link</button>
        </form>
      </div>
    </div>
  );
}
