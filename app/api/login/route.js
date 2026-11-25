import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  WEEK_MS,
  checkCredentials,
  createSessionToken,
} from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!checkCredentials(username, password)) {
    return NextResponse.json(
      { error: "Username atau password salah." },
      { status: 401 }
    );
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK_MS / 1000,
  });
  return res;
}
