"use client";

import Link from "next/link";
import TopRightMenu from "@/components/TopRightMenu";

export default function MessagesHeader({ title, backHref }: { title: string; backHref?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f3b2e]/95 px-4 pb-4 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Link href={backHref} className="text-2xl text-white" aria-label="Zurück">‹</Link>
          ) : null}
          <h1 className="truncate text-xl font-extrabold text-white">{title}</h1>
        </div>
        <TopRightMenu />
      </div>
    </header>
  );
}
