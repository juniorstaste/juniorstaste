"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type City = { id: string; name: string; slug: string };

const linkStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  fontSize: 18,
  cursor: "pointer",
  textAlign: "left",
  textDecoration: "none",
  color: "black",
  display: "block",
};

export default function Home() {
  const [cities, setCities] = useState<City[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadCities() {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, slug")
        .order("name", { ascending: true });

console.log("CITIES FROM SUPABASE:", data, "ERROR:", error);

      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setCities(data ?? []);
    }

    loadCities();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
<h1 className="text-3xl font-bold text-red-600 mb-4">
  Juniorstaste
</h1>
      <p style={{ marginBottom: 24 }}>
        Wähle eine Stadt und entdecke meine Foodspots.
      </p>

      <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
        {errorMsg ? (
          <div style={{ padding: 12, border: "1px solid red" }}>
            Supabase-Fehler: {errorMsg}
          </div>
        ) : cities.length === 0 ? (
          <div style={{ padding: 12, border: "1px solid #ddd" }}>
            Lade Städte…
          </div>
        ) : (
          cities.map((c) => (
            <a key={c.id} href={`/city/${c.slug}`} style={linkStyle}>
              {c.name}
            </a>
          ))
        )}
      </div>
    </main>
  );
}
<h1 className="text-3xl font-bold">Juniorstaste</h1>