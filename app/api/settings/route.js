import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { TOPICS, mqttConfigured, publish } from "../../../lib/mqtt-server";

export const dynamic = "force-dynamic";

export async function PUT(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  let capacity = null;
  let mode = null;
  let locked = null;

  if (body.capacity !== undefined) {
    capacity = parseInt(body.capacity, 10);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 999) {
      return NextResponse.json({ error: "Kapasitas harus 1 sampai 999." }, { status: 400 });
    }
  }
  if (body.mode !== undefined) {
    if (!["auto", "manual"].includes(body.mode)) {
      return NextResponse.json({ error: "Mode tidak valid." }, { status: 400 });
    }
    mode = body.mode;
  }
  if (body.locked !== undefined) locked = Boolean(body.locked);

  const sql = db();

  if (capacity !== null) {
    const [d] = await sql`select occupied from device_state where id = 1`;
    if (capacity < d.occupied) {
      return NextResponse.json(
        { error: `Kapasitas tidak boleh di bawah jumlah kendaraan saat ini (${d.occupied}).` },
        { status: 400 }
      );
    }
  }

  const [s] = await sql`
    update settings set
      capacity = coalesce(${capacity}::int, capacity),
      mode = coalesce(${mode}::text, mode),
      locked = coalesce(${locked}::boolean, locked)
    where id = 1
    returning capacity, mode, locked`;

  const notes = [];
  if (capacity !== null) notes.push(`kapasitas ${s.capacity}`);
  if (mode !== null) notes.push(`mode ${s.mode === "auto" ? "otomatis" : "manual"}`);
  if (locked !== null) notes.push(s.locked ? "parkir ditutup" : "parkir dibuka");
  await sql`insert into events (type, message) values ('info', ${"Admin mengubah pengaturan: " + notes.join(", ")})`;

  // Kirim ke ESP32 lewat MQTT (retained, supaya ESP32 yang baru menyala ikut menerima).
  // Jika MQTT tidak aktif, ESP32 tetap menerimanya dari respons heartbeat berikutnya.
  let pushed = false;
  if (mqttConfigured()) {
    try {
      await publish(TOPICS.settings, JSON.stringify(s), { retain: true });
      pushed = true;
    } catch (e) {
      console.error("Gagal publish settings:", e.message);
    }
  }
  return NextResponse.json({ settings: s, pushedViaMqtt: pushed });
}
