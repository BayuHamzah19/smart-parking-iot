// Pengganti ESP32 untuk menguji dashboard tanpa hardware.
// Pakai:  npm run simulate -- in     (kendaraan masuk)
//         npm run simulate -- out    (kendaraan keluar)
//         npm run simulate -- beat   (heartbeat saja)
const base = process.env.BASE_URL || "http://localhost:3000";
const key = process.env.DEVICE_API_KEY;
const action = process.argv[2] || "beat";

async function post(path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  if (!key) {
    console.error("DEVICE_API_KEY belum diisi di .env.local");
    process.exit(1);
  }

  // Heartbeat tanpa "occupied" supaya server mengembalikan nilai terakhir.
  const s = await post("/api/device/heartbeat", {});
  console.log("Heartbeat OK:", s);
  if (action !== "in" && action !== "out") return;

  let occ = s.occupied;
  if (action === "in") {
    if (s.locked) return console.log("Parkir ditutup, kendaraan ditolak.");
    if (occ >= s.capacity) {
      await post("/api/device/event", { type: "warn", message: "Masuk ditolak: parkir penuh", occupied: occ });
      return console.log("Parkir penuh.");
    }
    occ += 1;
  } else {
    if (occ <= 0) {
      await post("/api/device/event", { type: "warn", message: "Sensor keluar aktif, tetapi tidak ada kendaraan tercatat", occupied: occ });
      return console.log("Tidak ada kendaraan tercatat.");
    }
    occ -= 1;
  }

  const gate = action === "in" ? { gateIn: true } : { gateOut: true };
  await post("/api/device/event", {
    type: action,
    message: `Kendaraan ${action === "in" ? "masuk" : "keluar"}, terisi ${occ}/${s.capacity}`,
    occupied: occ,
    ...gate,
  });
  console.log(`Terkirim: kendaraan ${action}, terisi ${occ}/${s.capacity}`);

  // Tutup palang setelah 2 detik, seperti perilaku ESP32
  await new Promise((r) => setTimeout(r, 2000));
  await post("/api/device/heartbeat", { occupied: occ, gateIn: false, gateOut: false });
  console.log("Palang ditutup.");
}

main().catch((e) => {
  console.error("Gagal:", e.message);
  process.exit(1);
});
