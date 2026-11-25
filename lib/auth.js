import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "sp_session";
export const WEEK_MS = 7 * 24 * 3600 * 1000;

function sign(value) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET belum diisi di .env.local");
  }
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(value)
    .digest("hex");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function createSessionToken() {
  const exp = String(Date.now() + WEEK_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (!safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

// Dipakai di server component dan API route (admin).
export async function isAdmin() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export function checkCredentials(username, password) {
  const u = process.env.ADMIN_USERNAME || "admin";
  const p = process.env.ADMIN_PASSWORD || "";
  if (!p) return false;
  return safeEqual(username ?? "", u) && safeEqual(password ?? "", p);
}

// Dipakai di API untuk ESP32 (header x-api-key).
export function isDevice(req) {
  const key = process.env.DEVICE_API_KEY;
  if (!key) return false;
  return safeEqual(req.headers.get("x-api-key") ?? "", key);
}
