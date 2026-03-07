"use client";

import { useRouter } from "next/navigation";

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20a8 8 0 0 1 16 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ProfileButton() {
  const router = useRouter();

  return (
    <button
  type="button"
  onClick={() => router.push("/saved")}
  className="inline-flex items-center justify-center text-white transition hover:scale-110"
  aria-label="Gespeicherte Spots"
  title="Gespeicherte Spots"
>
  <ProfileIcon />
</button>
  );
}