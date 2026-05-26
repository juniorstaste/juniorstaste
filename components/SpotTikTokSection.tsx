"use client";

import { memo } from "react";
import TikTokEmbed from "@/components/TikTokEmbed";

type Props = {
  embedInstanceId?: string;
  videoId: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

function SpotTikTokSection({ embedInstanceId, videoId, onClick }: Props) {
  return (
    <div className="mt-6" onClick={onClick}>
      <div className="mx-auto min-w-0 w-full max-w-[420px]">
        <TikTokEmbed
          embedInstanceId={embedInstanceId}
          username="juniorstaste"
          videoId={videoId}
          height={760}
          loadMode="nearby"
        />
      </div>
    </div>
  );
}

export default memo(SpotTikTokSection);
