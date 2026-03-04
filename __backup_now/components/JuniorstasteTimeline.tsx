"use client";

import { useEffect } from "react";

type Props = {
  username: string; // z.B. "juniorstaste"
};

export default function JuniorstasteTimeline({ username }: Props) {
  useEffect(() => {
    // ✅ TikTok Script neu "anstoßen", wenn du den Tab wechselst
    // (weil TikTok oft nur beim ersten Laden parsed)
    // @ts-ignore
    if (window.tiktokEmbedLoad) {
      // @ts-ignore
      window.tiktokEmbedLoad();
    }
  }, []);

  return (
    <div className="mt-4">
      {/* TikTok Profil Timeline */}
      <blockquote
        className="tiktok-embed"
        cite={`https://www.tiktok.com/@${username}`}
        data-unique-id={username}
        data-embed-type="creator"
        style={{ maxWidth: 780, minWidth: 288 }}
      >
        <section>
          <a target="_blank" rel="noreferrer" href={`https://www.tiktok.com/@${username}`}>
            @{username}
          </a>
        </section>
      </blockquote>
    </div>
  );
}