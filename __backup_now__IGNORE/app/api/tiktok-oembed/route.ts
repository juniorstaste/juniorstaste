import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    // TikTok oEmbed liefert u.a. thumbnail_url + title
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      // TikTok ist manchmal pingelig – User-Agent hilft oft
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      // bei Vercel/Next: keine harte Cache-Falle
      cache: "no-store",
    });

    if (!r.ok) {
      return NextResponse.json({ error: `TikTok oEmbed failed (${r.status})` }, { status: 500 });
    }

    const data = await r.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}