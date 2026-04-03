"use client";

import TikTokEmbed from "@/components/TikTokEmbed";

type Props = {
  videoId: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export default function SpotTikTokSection({ videoId, onClick }: Props) {
  return (
    <div className="mt-6" onClick={onClick}>
      <div className="mx-auto min-w-0 w-full max-w-[420px]">
        <TikTokEmbed
          username="juniorstaste"
          videoId={videoId}
          height={760}
          loadMode="nearby"
        />
      </div>
    </div>
  );
}
