"use client";

import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import TopRightMenu from "@/components/TopRightMenu";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-extrabold text-[#1f1f1f]">{title}</h2>
      <div className="mt-3 space-y-4 text-[15px] leading-7 text-[#2f2a23]">{children}</div>
    </section>
  );
}

export default function DatenschutzPage() {
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
            Datenschutz
          </h1>
        </div>

        <div className="rounded-3xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-6 text-[#1f1f1f] shadow-sm">
          <p className="text-[15px] leading-7 text-[#2f2a23]">
            Diese Datenschutzerklärung informiert darüber, wie personenbezogene Daten bei der
            Nutzung dieser Website bzw. Web-App verarbeitet werden. Sie gilt für die Nutzung von
            Junior&apos;s Taste unter Beachtung der Datenschutz-Grundverordnung (DSGVO) und der in
            Deutschland geltenden Datenschutzvorschriften.
          </p>

          <Section title="Verantwortlicher">
            <p>
              Emmanuel-Junior Nager
              <br />
              Bettina-von-Arnim-Straße 21/1
              <br />
              73760 Ostfildern
              <br />
              E-Mail:{" "}
              <a
                href="mailto:juniorschmeckt@gmail.com"
                className="font-semibold text-[#0f3b2e] underline underline-offset-2"
              >
                juniorschmeckt@gmail.com
              </a>
            </p>
          </Section>

          <Section title="Allgemeine Hinweise zur Datenverarbeitung">
            <p>
              Personenbezogene Daten werden nur verarbeitet, soweit dies zur Bereitstellung der
              Website, ihrer Funktionen und Inhalte sowie zur Sicherstellung eines stabilen und
              sicheren Betriebs erforderlich ist. Die Verarbeitung erfolgt insbesondere auf Basis
              von Art. 6 Abs. 1 lit. b DSGVO, soweit Daten zur Durchführung vorvertraglicher
              Maßnahmen oder zur Bereitstellung eines Nutzerkontos erforderlich sind, sowie auf
              Basis von Art. 6 Abs. 1 lit. f DSGVO, soweit ein berechtigtes Interesse an einem
              sicheren, funktionsfähigen und nutzerfreundlichen Angebot besteht.
            </p>
          </Section>

          <Section title="Hosting über Vercel">
            <p>
              Diese Website wird über Vercel gehostet. Beim Aufruf der Website können technisch
              erforderliche Verbindungsdaten verarbeitet werden, etwa IP-Adresse,
              Browserinformationen, Datum und Uhrzeit des Zugriffs sowie Protokolldaten. Die
              Verarbeitung erfolgt zur Auslieferung der Website, zur Stabilität und zur
              Systemsicherheit.
            </p>
          </Section>

          <Section title="Datenverarbeitung über Supabase">
            <p>
              Für Datenbankfunktionen, Authentifizierung und die Speicherung nutzerbezogener
              Inhalte wird Supabase verwendet. Dabei können je nach Nutzung insbesondere
              Kontodaten, gespeicherte Spots, Klickereignisse und technische Metadaten verarbeitet
              werden. Die Verarbeitung erfolgt zur Bereitstellung der in der App angebotenen
              Funktionen.
            </p>
          </Section>

          <Section title="Registrierung und Login">
            <p>
              Wenn ein Nutzer ein Konto erstellt oder sich anmeldet, werden insbesondere die
              E-Mail-Adresse, das Passwort in technisch abgesicherter Form sowie Profilangaben wie
              der angegebene Name verarbeitet. Diese Daten werden benötigt, um das Nutzerkonto zu
              erstellen, Anmeldungen zu ermöglichen und geschützte Funktionen personalisiert
              bereitzustellen.
            </p>
          </Section>

          <Section title="Speicherung gespeicherter Spots">
            <p>
              Wenn ein eingeloggter Nutzer Spots speichert, wird diese Information
              kontobezogen in der Datenbank gespeichert. Dabei wird insbesondere verarbeitet,
              welcher Nutzer welchen Spot gespeichert hat. Dies dient dazu, gespeicherte Inhalte
              geräteübergreifend und dauerhaft dem jeweiligen Nutzerkonto zuzuordnen.
            </p>
          </Section>

          <Section title="Klicktracking über click_events">
            <p>
              Bei Klicks auf externe Spot-Buttons wie Google Maps, Wolt, Lieferando oder Uber Eats
              kann ein Klickereignis in der Datenbank gespeichert werden. Dabei werden je nach
              Nutzung insbesondere die Spot-ID, der Button-Typ, der Zeitpunkt des Klicks und -
              sofern der Nutzer eingeloggt ist - die Nutzer-ID verarbeitet. Dies dient der
              technischen und inhaltlichen Auswertung der Nutzung einzelner Verlinkungen innerhalb
              des Angebots.
            </p>
          </Section>

          <Section title="Standortdaten und Geolokation">
            <p>
              Wenn die Funktion &quot;Standort verwenden&quot; aktiv genutzt wird, wird der aktuelle
              Standort des Geräts ausschließlich nach Freigabe durch den Nutzer verarbeitet. Die
              Standortdaten werden verwendet, um Spots in der Nähe anzuzeigen, Entfernungen zu
              berechnen oder Karten auf den aktuellen Standort auszurichten. Ohne Freigabe erfolgt
              keine Standortnutzung.
            </p>
          </Section>

          <Section title="TikTok-Embeds">
            <p>
              Auf einzelnen Seiten können eingebettete TikTok-Videos angezeigt werden. Beim Laden
              solcher Inhalte kann es dazu kommen, dass Daten wie IP-Adresse, Geräteinformationen
              oder Nutzungsdaten an TikTok bzw. technisch eingebundene Drittdienste übertragen
              werden. Für die Datenverarbeitung durch TikTok gelten deren eigene
              Datenschutzbestimmungen.
            </p>
          </Section>

          <Section title="Externe Links und Weiterleitungen zu Drittanbietern">
            <p>
              Die App enthält Verlinkungen zu externen Diensten und Plattformen, insbesondere zu
              Google Maps, Wolt, Lieferando und Uber Eats. Beim Anklicken solcher Links verlassen
              Nutzer das Angebot von Junior&apos;s Taste. Für die Verarbeitung personenbezogener
              Daten auf den Zielseiten sind ausschließlich die jeweiligen Anbieter verantwortlich.
            </p>
          </Section>

          <Section title="Darstellung von Spots, Städten, Kategorien und gespeicherten Inhalten">
            <p>
              Zur Bereitstellung der App-Inhalte werden Daten zu Spots, Städten, Kategorien,
              eingebetteten Medien und nutzerbezogen gespeicherten Inhalten aus Supabase geladen
              und innerhalb der Anwendung dargestellt. Soweit Inhalte kontobezogen sind, erfolgt
              die Zuordnung ausschließlich zum jeweiligen Nutzerkonto.
            </p>
          </Section>

          <Section title="Speicherdauer">
            <p>
              Personenbezogene Daten werden nur so lange gespeichert, wie dies für die jeweiligen
              Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen. Kontodaten,
              gespeicherte Spots und zugehörige Nutzungsdaten bleiben in der Regel gespeichert,
              solange das Nutzerkonto besteht oder bis eine Löschung verlangt wird, sofern keine
              gesetzlichen Pflichten entgegenstehen.
            </p>
          </Section>

          <Section title="Rechte der betroffenen Personen">
            <p>
              Betroffene Personen haben nach der DSGVO insbesondere das Recht auf Auskunft, das
              Recht auf Berichtigung unrichtiger Daten, das Recht auf Löschung, das Recht auf
              Einschränkung der Verarbeitung, das Recht auf Datenübertragbarkeit sowie das Recht auf
              Widerspruch gegen bestimmte Verarbeitungen. Außerdem besteht das Recht, eine erteilte
              Einwilligung jederzeit mit Wirkung für die Zukunft zu widerrufen.
            </p>
          </Section>

          <Section title="Beschwerderecht nach DSGVO">
            <p>
              Betroffene Personen haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu
              beschweren, wenn sie der Ansicht sind, dass die Verarbeitung ihrer personenbezogenen
              Daten gegen die DSGVO verstößt.
            </p>
          </Section>

          <Section title="Kontakt für Datenschutzanfragen">
            <p>
              Bei Fragen zur Verarbeitung personenbezogener Daten oder zur Geltendmachung von
              Betroffenenrechten kann Kontakt aufgenommen werden unter:
              <br />
              <a
                href="mailto:juniorschmeckt@gmail.com"
                className="font-semibold text-[#0f3b2e] underline underline-offset-2"
              >
                juniorschmeckt@gmail.com
              </a>
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
