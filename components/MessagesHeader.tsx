"use client";

import TopRightMenu from "@/components/TopRightMenu";

export default function MessagesHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f3b2e]/95 px-4 pb-4 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <button type="button" onClick={onBack} className="text-2xl text-white" aria-label="Zurück">‹</button>
          ) : null}
          <h1 className="truncate text-xl font-extrabold text-white">{title}</h1>
        </div>
        <TopRightMenu />
      </div>
    </header>
  );
}
