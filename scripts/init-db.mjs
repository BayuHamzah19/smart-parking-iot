import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum diisi di .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  create table if not exists settings (
    id int primary key default 1,
    capacity int not null default 10,
    mode text not null default 'auto',
    locked boolean not null default false
  )`;
await sql`insert into settings (id) values (1) on conflict (id) do nothing`;

await sql`
  create table if not exists device_state (
    id int primary key default 1,
    occupied int not null default 0,
    gate_in boolean not null default false,
    gate_out boolean not null default false,
    last_seen timestamptz
  )`;
await sql`insert into device_state (id) values (1) on conflict (id) do nothing`;

await sql`
  create table if not exists events (
    id bigserial primary key,
    ts timestamptz not null default now(),
    type text not null,
    message text not null,
    occupied int
  )`;
await sql`create index if not exists events_ts_idx on events (ts desc)`;

console.log("Database siap: tabel settings, device_state, dan events sudah dibuat.");
