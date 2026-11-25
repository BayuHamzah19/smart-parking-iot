import { NextResponse } from "next/server";
import { isDevice } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

export const dynamic = "force-dynamic";

const TYPES = ["in", "out", "warn", "info"];

// ESP32 memanggil endpoint ini setiap ada kejadian (kendaraan masuk/keluar, dll).
export async function POST(req) {
  if (!isDevice(req)) return NextResponse.json({ error: "Kunci perangkat salah" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || !TYPES.includes(b.type) || typeof b.message !== "string") {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const occupied = Number.isInteger(b.occupied) ? b.occupied : null;
  const gateIn = typeof b.gateIn === "boolean" ? b.gateIn : null;
  const gateOut = typeof b.gateOut === "boolean" ? b.gateOut : null;

  const sql = db();
  await sql`insert into events (type, message, occupied)
            values (${b.type}, ${b.message.slice(0, 200)}, ${occupied})`;
  await sql`update device_state set
              occupied = coalesce(${occupied}::int, occupied),
              gate_in = coalesce(${gateIn}::boolean, gate_in),
              gate_out = coalesce(${gateOut}::boolean, gate_out),
              last_seen = now()
            where id = 1`;
  return NextResponse.json({ ok: true });
}
