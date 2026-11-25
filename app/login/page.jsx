"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login gagal.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Tidak bisa terhubung ke server.");
    }
    setBusy(false);
  }

  return (
    <main className="wrap">
      <form className="card login" onSubmit={submit}>
        <h1>Smart Parking</h1>
        <p className="mut">Masuk sebagai admin untuk memantau dan mengontrol palang.</p>
        <label htmlFor="u">Username</label>
        <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        <label htmlFor="p">Password</label>
        <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <p className="err">{error}</p>
        <button className="p" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Memeriksa..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
