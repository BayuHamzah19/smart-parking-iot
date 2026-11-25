import { neon } from "@neondatabase/serverless";

// Dibuat saat dipanggil (bukan saat import) supaya build tidak gagal
// ketika DATABASE_URL belum diisi.
export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum diisi di .env.local");
  }
  return neon(process.env.DATABASE_URL);
}

// Perangkat dianggap online jika heartbeat terakhir kurang dari 25 detik.
export const ONLINE_SECONDS = 25;
