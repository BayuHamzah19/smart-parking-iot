import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

// Jumlah kendaraan masuk/keluar per jam untuk 6 jam terakhir.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const sql = db();
  const rows = await sql`
    select date_trunc('hour', ts) as hour,
           count(*) filter (where type = 'in')::int as masuk,
           count(*) filter (where type = 'out')::int as keluar
    from events
    where ts >= date_trunc('hour', now()) - interval '5 hours'
    group by 1
    order by 1`;
  return NextResponse.json({ hours: rows });
}
