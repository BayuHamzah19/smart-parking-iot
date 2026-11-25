"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TYPE_LABEL = {
  in: ["Masuk", "ok"],
  out: ["Keluar", ""],
  warn: ["Peringatan", "bad"],
  info: ["Info", "warn"],
};
const HOUR = 3600 * 1000;
const POLL_MS = 2000;

async function api(path, options) {
  const res = await fetch(path, {
    cache: "no-store",
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Sesi berakhir");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
  return data;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Dashboard() {
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [hours, setHours] = useState([]);
  const [filters, setFilters] = useState({ from: "", to: "", type: "" });
  const [capInput, setCapInput] = useState("");
  const [notice, setNotice] = useState(null); // { text, bad }
  const [live, setLive] = useState("off"); // off | connecting | on | error
  const [loadError, setLoadError] = useState("");

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const capInit = useRef(false);
  const liveTimer = useRef(null);

  const refreshStatus = useCallback(async () => {
    const s = await api("/api/status");
    setStatus(s);
    if (!capInit.current) {
      setCapInput(String(s.capacity));
      capInit.current = true;
    }
  }, []);

  const refreshLogs = useCallback(async () => {
    const f = filtersRef.current;
    const q = new URLSearchParams({ limit: "50" });
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
    if (f.type) q.set("type", f.type);
    const data = await api("/api/logs?" + q.toString());
    setLogs(data.logs);
  }, []);

  const refreshStats = useCallback(async () => {
    const data = await api("/api/stats");
    setHours(data.hours);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([refreshStatus(), refreshLogs(), refreshStats()]);
      setLoadError("");
    } catch (e) {
      if (e.message !== "Sesi berakhir") {
        setLoadError("Gagal memuat data. Pastikan database sudah disiapkan (npm run db:init).");
      }
    }
  }, [refreshStatus, refreshLogs, refreshStats]);

  // Polling dasar: tetap jalan walaupun MQTT tidak aktif.
  useEffect(() => {
    refreshAll();
    const t = setInterval(refreshAll, POLL_MS);
    return () => clearInterval(t);
  }, [refreshAll]);

  // Muat ulang log saat filter berubah.
  useEffect(() => {
    refreshLogs().catch(() => {});
  }, [filters, refreshLogs]);

  // Tampilan live lewat MQTT over WebSocket (opsional).
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_MQTT_WS_URL;
    if (!url) return;
    let client = null;
    let dead = false;

    (async () => {
      const m = await import("mqtt");
      const mqtt = m.default ?? m;
      if (dead) return;
      setLive("connecting");
      client = mqtt.connect(url, {
        username: process.env.NEXT_PUBLIC_MQTT_USERNAME || undefined,
        password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || undefined,
        reconnectPeriod: 3000,
      });
      client.on("connect", () => {
        setLive("on");
        client.subscribe("sp-69fd16a8/parking/live");
      });
      client.on("close", () => setLive("connecting"));
      client.on("error", () => setLive("error"));
      client.on("message", (_topic, payload) => {
        try {
          const d = JSON.parse(payload.toString());
          setStatus((s) =>
            s
              ? {
                  ...s,
                  occupied: d.occupied ?? s.occupied,
                  gateIn: d.gateIn ?? s.gateIn,
                  gateOut: d.gateOut ?? s.gateOut,
                  online: true,
                }
              : s
          );
          // Beri waktu ESP32 menyimpan log ke database, lalu muat ulang.
          clearTimeout(liveTimer.current);
          liveTimer.current = setTimeout(() => {
            refreshLogs().catch(() => {});
            refreshStats().catch(() => {});
          }, 900);
        } catch {}
      });
    })();

    return () => {
      dead = true;
      clearTimeout(liveTimer.current);
      if (client) client.end(true);
    };
  }, [refreshLogs, refreshStats]);

  function say(text, bad = false) {
    setNotice({ text, bad });
  }

  async function sendGate(gate, action) {
    try {
      await api("/api/command", { method: "POST", body: JSON.stringify({ gate, action }) });
      say(`Perintah ${action === "open" ? "buka" : "tutup"} palang ${gate === "in" ? "masuk" : "keluar"} terkirim.`);
    } catch (e) {
      say(e.message, true);
    }
  }

  async function saveSettings(patch, okText) {
    try {
      const r = await api("/api/settings", { method: "PUT", body: JSON.stringify(patch) });
      say(okText + (r.pushedViaMqtt ? "" : " (ESP32 menerima pada heartbeat berikutnya)"));
      await refreshAll();
    } catch (e) {
      say(e.message, true);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!status) {
    return (
      <main className="wrap">
        <p className="mut">{loadError || "Memuat dashboard..."}</p>
      </main>
    );
  }

  const free = Math.max(status.capacity - status.occupied, 0);
  const pct = Math.min(100, Math.round((status.occupied / status.capacity) * 100));
  const stat = status.locked ? ["Ditutup", "warn"] : free <= 0 ? ["Penuh", "bad"] : ["Tersedia", "ok"];
  const liveLabel = { off: "MQTT live nonaktif", connecting: "MQTT menyambung", on: "MQTT live aktif", error: "MQTT gagal" }[live];
  const liveClass = live === "on" ? "ok" : live === "off" ? "" : "warn";

  // Susun 6 slot jam terakhir (jam tanpa data diisi 0).
  const nowHour = Math.floor(Date.now() / HOUR) * HOUR;
  const slots = [5, 4, 3, 2, 1, 0].map((i) => {
    const start = nowHour - i * HOUR;
    const row = hours.find((h) => new Date(h.hour).getTime() === start);
    return { start, masuk: row?.masuk ?? 0, keluar: row?.keluar ?? 0 };
  });
  const maxBar = Math.max(1, ...slots.map((s) => Math.max(s.masuk, s.keluar)));

  return (
    <main className="wrap">
      <div className="top">
        <div>
          <h1>Smart Parking Admin</h1>
          <span className="mut">Dashboard monitoring dan kontrol palang</span>
        </div>
        <div className="row">
          <span className={"pill " + liveClass}>{liveLabel}</span>
          <span className={"pill " + (status.online ? "ok" : "bad")}>
            {status.online ? "Perangkat online" : "Perangkat offline"}
          </span>
          <button onClick={logout}>Keluar</button>
        </div>
      </div>

      {notice && <div className={"note" + (notice.bad ? " bad" : "")} role="status">{notice.text}</div>}

      <div className="grid">
        <section className="card">
          <h2>Slot parkir</h2>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <span className="big">{free}</span>
              <div className="mut">slot tersedia</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className={"pill " + stat[1]}>{stat[0]}</span>
              <div className="mut" style={{ marginTop: 6 }}>
                {status.occupied} terisi dari {status.capacity}
              </div>
            </div>
          </div>
          <div className="bar">
            <i style={{ width: pct + "%", background: pct >= 100 ? "var(--bad)" : pct >= 80 ? "var(--b2)" : "var(--ac)" }} />
          </div>
        </section>

        <section className="card">
          <h2>Palang</h2>
          {[
            ["in", "Palang masuk", status.gateIn],
            ["out", "Palang keluar", status.gateOut],
          ].map(([g, name, open]) => (
            <div className="gate" key={g}>
              <div className="post"><div className={"arm" + (open ? " open" : "")} /></div>
              <div className="info">
                <b>{name}</b>
                <div className="mut">{open ? "Terbuka" : "Tertutup"}</div>
              </div>
              <div className="row">
                <button onClick={() => sendGate(g, "open")}>Buka</button>
                <button onClick={() => sendGate(g, "close")}>Tutup</button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="grid">
        <section className="card">
          <h2>Pengaturan sistem</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            <button className={status.mode === "auto" ? "on" : ""} onClick={() => saveSettings({ mode: "auto" }, "Mode diubah ke otomatis.")}>
              Mode otomatis
            </button>
            <button className={status.mode === "manual" ? "on" : ""} onClick={() => saveSettings({ mode: "manual" }, "Mode diubah ke manual.")}>
              Mode manual
            </button>
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <button
              className={status.locked ? "d" : ""}
              onClick={() => saveSettings({ locked: !status.locked }, status.locked ? "Parkir dibuka kembali." : "Parkir ditutup.")}
            >
              {status.locked ? "Buka parkir" : "Tutup parkir"}
            </button>
            {status.locked && <span className="mut">Palang masuk tidak akan terbuka</span>}
          </div>
          <label htmlFor="cap">Kapasitas maksimum</label>
          <div className="row">
            <input id="cap" type="number" min="1" max="999" style={{ width: 110 }} value={capInput} onChange={(e) => setCapInput(e.target.value)} />
            <button onClick={() => saveSettings({ capacity: capInput }, "Kapasitas disimpan.")}>Simpan</button>
          </div>
        </section>

        <section className="card">
          <h2>Kendaraan per jam (6 jam terakhir)</h2>
          <div className="row mut legend">
            <span><i style={{ background: "var(--ac)" }} />Masuk</span>
            <span><i style={{ background: "var(--b2)" }} />Keluar</span>
          </div>
          <div className="chart">
            {slots.map((s) => (
              <div className="col" key={s.start}>
                <div className="bars">
                  <i style={{ height: (s.masuk / maxBar) * 100 + "%", background: "var(--ac)" }} title={"Masuk " + s.masuk} />
                  <i style={{ height: (s.keluar / maxBar) * 100 + "%", background: "var(--b2)" }} title={"Keluar " + s.keluar} />
                </div>
                <span className="mut" style={{ fontSize: 12 }}>
                  {new Date(s.start).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Log aktivitas</h2>
        <div className="filters">
          <div>
            <label htmlFor="ff">Dari tanggal</label>
            <input id="ff" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label htmlFor="ft">Sampai tanggal</label>
            <input id="ft" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div>
            <label htmlFor="fy">Jenis</label>
            <select id="fy" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">Semua</option>
              <option value="in">Masuk</option>
              <option value="out">Keluar</option>
              <option value="warn">Peringatan</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Waktu (WIB)</th><th>Jenis</th><th>Keterangan</th></tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan="3" className="mut">Belum ada aktivitas. Jalankan ESP32 atau <code>npm run simulate -- in</code>.</td></tr>
              )}
              {logs.map((l) => {
                const k = TYPE_LABEL[l.type] || ["Info", "warn"];
                return (
                  <tr key={l.id}>
                    <td>{fmtTime(l.ts)}</td>
                    <td><span className={"pill " + k[1]}>{k[0]}</span></td>
                    <td>{l.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
