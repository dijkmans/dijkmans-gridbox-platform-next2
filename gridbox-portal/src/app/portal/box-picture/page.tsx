"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

function PageContentRouter() {
  const searchParams = useSearchParams();
  const boxId = searchParams.get("id") || "";

  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPicture() {
    try {
      setLoading(true);
      setMessage("");

      if (!boxId) {
        setImageUrl("");
        setMessage("Geen box-id opgegeven");
        return;
      }

      const user = auth.currentUser;

      if (!user) {
        setImageUrl("");
        setMessage("Meld je aan om picture te bekijken");
        return;
      }

      const token = await user.getIdToken();

      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/picture`), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });

      if (!res.ok) {
        let errorText = "Kon picture niet ophalen";
        try {
          const data = await res.json();
          errorText = data.message || errorText;
        } catch {}
        setImageUrl("");
        setMessage(errorText);
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      setImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return objectUrl;
      });
    } catch {
      setImageUrl("");
      setMessage("Netwerkfout bij ophalen van picture");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    const unsubscribe = auth.onAuthStateChanged(async () => {
      if (!active) return;
      await loadPicture();
    });

    void loadPicture();

    return () => {
      active = false;
      unsubscribe();
      setImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return "";
      });
    };
  }, [boxId]);

  return (
    <main className="min-h-screen bg-slate-50 p-5 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-5">

        {/* Header */}
        <header className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-900">Box snapshot</h1>
          <p className="text-sm text-slate-500 mt-1">🆔 {boxId || "—"}</p>
        </header>

        {/* Acties */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-3 flex flex-wrap gap-3 items-center w-fit">
          <button
            type="button"
            onClick={() => void loadPicture()}
            className="rounded-xl border border-slate-200 bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            🔄 Vernieuwen
          </button>
          {boxId && (
            <Link
              href={`/portal/box?id=${encodeURIComponent(boxId)}`}
              className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors no-underline"
            >
              ← Terug naar box
            </Link>
          )}
        </div>

        {/* Inhoud */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-10 flex justify-center">
            <div className="loader" />
          </div>
        )}

        {message && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-4 text-sm text-slate-600 font-semibold">
            {message}
          </div>
        )}

        {!loading && !message && imageUrl && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-4">
            <img
              src={imageUrl}
              alt={`Snapshot van ${boxId}`}
              className="w-full h-auto rounded-2xl block"
            />
          </div>
        )}

        {/* Footer */}
        <footer className="pt-2 pb-4">
          <Link href="/" className="text-sm text-slate-500 font-semibold hover:text-slate-900 transition-colors no-underline">
            ← Terug naar overzicht
          </Link>
        </footer>

      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Pagina laden...</p>
      </main>
    }>
      <PageContentRouter />
    </Suspense>
  );
}
