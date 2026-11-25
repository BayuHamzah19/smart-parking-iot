import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

const TYPES = ["in", "out", "warn", "info"];
const DAY_MS = 24 * 3600 * 1000;

// Filter tanggal memakai zona waktu WIB (+07:00)
function dayStart(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str || "")) return null;
  return new Date(`${str}T00:00:00+07:00`);
}

export async function GET(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const p = new URL(req.url).searchParams;

  const limit = Math.min(Math.max(parseInt(p.get("limit") || "50", 10) || 50, 1), 500);
  const from = dayStart(p.get("from"));
  const toDay = dayStart(p.get("to"));
  const to = toDay ? new Date(toDay.getTime() + DAY_MS) : null;
  const type = TYPES.includes(p.get("type")) ? p.get("type") : null;

  const fromIso = from ? from.toISOString() : null;
  const toIso = to ? to.toISOString() : null;

  const sql = db();
  const rows = await sql`
    select id, ts, type, message, occupied
    from events
    where (${fromIso}::timestamptz is null or ts >= ${fromIso}::timestamptz)
      and (${toIso}::timestamptz is null or ts < ${toIso}::timestamptz)
      and (${type}::text is null or type = ${type}::text)
    order by ts desc
    limit ${limit}`;
  return NextResponse.json({ logs: rows });
}
