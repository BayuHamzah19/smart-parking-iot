import { NextResponse } from "next/server";
import { isDevice } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

export const dynamic = "force-dynamic";

// ESP32 memanggil endpoint ini tiap ~10 detik.
// Fungsi: menandai perangkat online, menyinkronkan status palang,
// dan mengambil pengaturan terbaru dari admin.
// Jika "occupied" tidak dikirim (misalnya ESP32 baru menyala), server
// mengembalikan nilai terakhir supaya hitungan slot tidak hilang.
export async function POST(req) {
  if (!isDevice(req)) return NextResponse.json({ error: "Kunci perangkat salah" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) || {};

  const occupied = Number.isInteger(b.occupied) ? b.occupied : null;
  const gateIn = typeof b.gateIn === "boolean" ? b.gateIn : null;
  const gateOut = typeof b.gateOut === "boolean" ? b.gateOut : null;

  const sql = db();
  const [d] = await sql`update device_state set
      occupied = coalesce(${occupied}::int, occupied),
      gate_in = coalesce(${gateIn}::boolean, gate_in),
      gate_out = coalesce(${gateOut}::boolean, gate_out),
      last_seen = now()
    where id = 1
    returning occupied`;
  const [s] = await sql`select capacity, mode, locked from settings where id = 1`;

  return NextResponse.json({
    capacity: s.capacity,
    mode: s.mode,
    locked: s.locked,
    occupied: d.occupied,
  });
}
