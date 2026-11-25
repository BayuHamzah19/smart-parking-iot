import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { db, ONLINE_SECONDS } from "../../../lib/db";
import { mqttConfigured } from "../../../lib/mqtt-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const sql = db();
  const [s] = await sql`select capacity, mode, locked from settings where id = 1`;
  const [d] = await sql`
    select occupied, gate_in, gate_out,
           extract(epoch from (now() - last_seen)) as age
    from device_state where id = 1`;
  const age = d.age === null ? null : Number(d.age);
  return NextResponse.json({
    capacity: s.capacity,
    mode: s.mode,
    locked: s.locked,
    occupied: d.occupied,
    gateIn: d.gate_in,
    gateOut: d.gate_out,
    online: age !== null && age < ONLINE_SECONDS,
    mqttServer: mqttConfigured(),
  });
}
