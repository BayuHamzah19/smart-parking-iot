import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { TOPICS, mqttConfigured, publish } from "../../../lib/mqtt-server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const { gate, action } = await req.json().catch(() => ({}));

  if (!["in", "out"].includes(gate) || !["open", "close"].includes(action)) {
    return NextResponse.json({ error: "Perintah tidak valid." }, { status: 400 });
  }
  if (!mqttConfigured()) {
    return NextResponse.json(
      { error: "MQTT belum dikonfigurasi, perintah palang tidak bisa dikirim." },
      { status: 503 }
    );
  }

  try {
    await publish(
      gate === "in" ? TOPICS.cmdIn : TOPICS.cmdOut,
      action === "open" ? "OPEN" : "CLOSE"
    );
  } catch (e) {
    return NextResponse.json({ error: "Gagal mengirim ke broker: " + e.message }, { status: 502 });
  }

  const sql = db();
  const isOpen = (action === "open");
  if (gate === "in") {
    await sql`update device_state set gate_in = ${isOpen} where id = 1`;
  } else {
    await sql`update device_state set gate_out = ${isOpen} where id = 1`;
  }

  await sql`insert into events (type, message) values ('info',
    ${`Admin mengirim perintah ${action === "open" ? "buka" : "tutup"} palang ${gate === "in" ? "masuk" : "keluar"}`})`;
  return NextResponse.json({ ok: true });
}
