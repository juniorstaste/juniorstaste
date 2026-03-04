"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FeedItem = {
  id: string;
  url: string;
  title: string;
  publishedAt: string | null;
  thumbnail: string | null;
};

type Props = {
  username: string; // "juniorstaste"
};

// kleine Helper: sort by date
function timeOf(item: FeedItem) {
  const t = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 3v11.2a3.8 3.8 0 1 1-3.2-3.75V7.2c.7-.1 1.6-.1 3.2.1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 5c1.1 2.4 3 3.8 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function JuniorstasteGrid({ username }: Props) {
  const [all, setAll] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // paging
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const followUrl = useMemo(() => `https://www.tiktok.com/@${username}`, [username]);

  // 1) load feed once
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/tiktok-feed/${username}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Feed konnte nicht geladen werden (${res.status})`);

        const data = await res.json();
        const items: FeedItem[] = Array.isArray(data.items) ? data.items : [];

        // sort newest first (just to be safe)
        items.sort((a, b) => timeOf(b) - timeOf(a));

        if (!alive) return;
        setAll(items);
        setVisibleCount(PAGE_SIZE);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Unbekannter Fehler");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [username]);

  const visible = useMemo(() => all.slice(0, visibleCount), [all, visibleCount]);

  // 2) infinite scroll (IntersectionObserver)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;

        setVisibleCount((c) => {
          if (c >= all.length) return c;
          return Math.min(all.length, c + PAGE_SIZE);
        });
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [all.length]);

  if (loading) {
    return <div className="mt-4 text-white/80">Lade TikTok…</div>;
  }

  if (err) {
    return (
      <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4 text-white">
        <div className="font-semibold">TikTok konnte nicht geladen werden</div>
        <div className="mt-1 text-sm text-white/80">{err}</div>
      </div>
    );
  }

  if (all.length === 0) {
    return <div className="mt-4 text-white/80">Keine TikTok-Videos gefunden.</div>;
  }

  return (
    <div className="mt-3">
      {/* Profil-Kopf */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-white font-semibold">Juniorstaste</div>

        <a
          href={followUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl bg-[#e8decc] px-4 py-2 text-sm font-semibold text-[#0f3b2e] shadow-md hover:scale-[1.02] transition"
        >
          <TikTokIcon />
          @ {username} folgen
        </a>
      </div>

      {/* TikTok-Grid */}
      <div className="grid grid-cols-3 gap-3">
        {visible.map((v) => (
          <a
            key={v.id}
            href={v.url}
            target="_blank"
            rel="noreferrer"
            className="group relative block overflow-hidden rounded-2xl border border-white/15 bg-black/20 shadow-sm"
            title={v.title}
          >
            {/* Thumb */}
            <div className="relative w-full aspect-[9/16] bg-black/30">
              {v.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-black/30" />
              )}

              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-black/40 border border-white/25 flex items-center justify-center opacity-90 group-hover:opacity-100 transition">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M9 7l10 5-10 5V7z" fill="white" />
                  </svg>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Sentinel für Infinite Scroll */}
      <div ref={sentinelRef} className="h-10" />

      {/* kleines Ende */}
      {visibleCount >= all.length ? (
        <div className="mt-3 text-center text-xs text-white/60">Ende erreicht</div>
      ) : null}
    </div>
  );
}