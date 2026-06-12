"use client";

import TopRightMenu from "@/components/TopRightMenu";

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-[#0f3b2e]">
      <div className="mx-auto max-w-[560px] p-4 pb-16">
        <div className="mb-3 flex justify-end">
          <TopRightMenu />
        </div>

        <div className="mb-6 text-center">
          <img
            src="/logos/citypage-logo.png"
            alt="Junior's Taste"
            className="mx-auto h-auto w-[148px]"
          />
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
              heyhey. Management GmbH
              <br />
              Rosensteinstraße 19
              <br />
              70191 Stuttgart
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
