import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Anmeldung fehlgeschlagen." }, { status: 403 });
  }

  let credentials: { username?: unknown; password?: unknown };
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ error: "Anmeldung fehlgeschlagen." }, { status: 400 });
  }

  const username = typeof credentials.username === "string" ? credentials.username.trim() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  if (!username || username.length > 100 || username.includes("@") || !password) {
    return NextResponse.json({ error: "Anmeldung fehlgeschlagen." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publicKey || !secretKey) {
    return NextResponse.json({ error: "Username-Login ist noch nicht eingerichtet." }, { status: 503 });
  }

  const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
  const admin = createClient(url, secretKey, options);
  const { data: email, error: lookupError } = await admin.rpc("login_email_for_username", {
    login_username: username,
  });
  if (lookupError || !email) {
    return NextResponse.json({ error: "Username oder Passwort stimmen nicht." }, { status: 401 });
  }

  const auth = createClient(url, publicKey, options);
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ error: "Username oder Passwort stimmen nicht." }, { status: 401 });
  }

  return NextResponse.json(
    { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    { headers: { "Cache-Control": "no-store" } }
  );
}
