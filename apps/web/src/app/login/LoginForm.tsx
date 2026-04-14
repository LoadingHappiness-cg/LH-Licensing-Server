"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") || "");
    const password = String(formData.get("password") || "");

    setError(null);
    setPending(true);

    const result = await signIn("credentials", {
      username,
      password,
      callbackUrl,
      redirect: false
    });

    setPending(false);

    if (!result || result.error) {
      setError("Invalid username or password.");
      return;
    }

    window.location.href = result.url || callbackUrl;
  }

  return (
    <main className="login-screen">
      <div className="card login-card">
        <p className="eyebrow">Loading Happiness</p>
        <h1>Admin sign in</h1>
        <p className="subtitle">Use the local admin credentials configured on the VM.</p>

        <form onSubmit={onSubmit}>
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error ? <div className="detail-item" style={{ color: "var(--danger)" }}>{error}</div> : null}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
