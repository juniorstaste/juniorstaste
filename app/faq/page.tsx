"use client";

import TopRightMenu from "@/components/TopRightMenu";

const faqItems = [
  {
    question: "🍔 Wie werden die Likes berechnet?",
    answer:
      "Die angezeigte Like-Anzahl setzt sich aus den Likes auf Junior’s Taste und den Likes des zugehörigen TikTok-Videos zusammen.",
  },
  {
    question: "❤️ Muss ich mich anmelden, um Spots zu speichern?",
    answer:
      "Ja. Um Spots zu speichern, als Favoriten zu merken und weitere persönliche Funktionen zu nutzen, benötigst du ein kostenloses Konto.",
  },
  {
    question: "🎥 Warum stammen die Videos aus TikTok?",
    answer: (
      <>
        Alle Videos in der App stammen vom offiziellen Junior’s-Taste-TikTok-Kanal{" "}
        <a
          href="https://www.tiktok.com/@juniorstaste"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#0f3b2e] underline underline-offset-2"
        >
          @juniorstaste
        </a>
        . Dort werden die Videos ursprünglich veröffentlicht. Die App bietet dir zusätzlich einen
        zentralen Ort, an dem du alle getesteten Spots entdecken, sammeln und speichern kannst.
      </>
    ),
  },
  {
    question: "💰 Kostet die Nutzung der App etwas?",
    answer: "Nein. Die Nutzung der Junior’s-Taste-App ist kostenlos.",
  },
  {
    question: "🔄 Wie oft kommen neue Spots hinzu?",
    answer:
      "Jeder Spot, den Junior’s Taste testet, wird zeitnah in der App ergänzt, damit du immer auf dem neuesten Stand bleibst.",
  },
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#0f3b2e]">
      <div className="mx-auto max-w-[560px] px-4 pb-16 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
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
            FAQ
          </h1>
        </div>

        <div className="rounded-3xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-6 text-[#1f1f1f] shadow-sm">
          <div className="divide-y divide-[#d8cdbd]">
            {faqItems.map((item, index) => (
              <section key={item.question} className={index === 0 ? "pb-5" : "py-5"}>
                <h2 className="text-lg font-extrabold text-[#1f1f1f]">{item.question}</h2>
                <p className="mt-3 text-[15px] leading-7 text-[#2f2a23]">{item.answer}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
