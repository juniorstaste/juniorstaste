"use client";

import JuniorstasteTimeline from "@/components/JuniorstasteTimeline";

type Props = {
  username?: string;
  avatarSrc?: string; // z.B. "/tiktok-avatar.jpg"
};

export default function JuniorstasteProfileTab({
  username = "juniorstaste",
  avatarSrc = "/tiktok-avatar.jpg",
}: Props) {
  const followUrl = `https://www.tiktok.com/@${username}`;

  return (
    <div className="mt-4">
      {/* Profil Kopf */}
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="h-16 w-16 overflow-hidden rounded-full border border-white/20 bg-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} alt={username} className="h-full w-full object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-white font-extrabold text-lg truncate">{username}</div>
          <div className="text-white/70 text-sm truncate">@{username}</div>
        </div>

        <a
          href={followUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-2xl bg-[#e8decc] px-4 py-2 text-sm font-semibold text-[#0f3b2e] shadow-md transition hover:scale-[1.02]"
        >
          Folgen
        </a>
      </div>

      {/* Videos darunter */}
      <div className="mt-4">
        <JuniorstasteTimeline username={username} />
      </div>
    </div>
  );
}