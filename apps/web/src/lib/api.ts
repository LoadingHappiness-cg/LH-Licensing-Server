export async function apiFetch<T>(path: string, token: string, init: RequestInit = {}) {
  const base = process.env.API_BASE_URL || "";
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}
