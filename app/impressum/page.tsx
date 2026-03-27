"use client";

import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import TopRightMenu from "@/components/TopRightMenu";

export default function ImpressumPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#0f3b2e]">
      <div className="mx-auto max-w-[560px] p-4 pb-16">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center -ml-2 text-[28px] font-semibold leading-none text-white transition active:scale-90"
            aria-label="Zurück"
          >
            ‹
          </button>

          <TopRightMenu />
        </div>

        <div className="mb-6 text-center">
          <SiteHeader subtitle={null} compact />
          <h1 className="mt-4 text-3xl font-extrabold italic tracking-wide text-white md:text-4xl">
            Impressum
          </h1>
        </div>

        <section className="rounded-3xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-6 text-[#1f1f1f] shadow-sm">
          <h2 className="text-lg font-extrabold">Angaben gemäß § 5 DDG</h2>

          <div className="mt-5 space-y-5 text-[15px] leading-7">
            <p>
              Emmanuel-Junior Nager
              <br />
              Bettina-von-Arnim-Straße 21/1
              <br />
              73760 Ostfildern
            </p>

            <div>
              <div className="font-bold">Kontakt:</div>
              <p>
                E-Mail:{" "}
                <a
                  href="mailto:juniorschmeckt@gmail.com"
                  className="font-semibold text-[#0f3b2e] underline underline-offset-2"
                >
                  juniorschmeckt@gmail.com
                </a>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
