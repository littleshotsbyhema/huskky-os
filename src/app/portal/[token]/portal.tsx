"use client";

import { useEffect, useState } from "react";
import { createBrowser, proofUrl } from "@/lib/supabase/browser";

type Proof = { id: string; path: string; filename: string; picked: boolean };
type Data = {
  job_id: string; title: string; couple_names: string; limit: number | null;
  submitted_at: string | null; gallery_url: string | null; stage: string; proofs: Proof[];
};

export default function Portal({ token, initial }: { token: string; initial: Data }) {
  const [data, setData] = useState<Data>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<Proof | null>(null);
  const [onlyPicked, setOnlyPicked] = useState(false);
  const supabase = createBrowser();

  const picked = data.proofs.filter((p) => p.picked);
  const locked = !!data.submitted_at;
  const shown = onlyPicked ? picked : data.proofs;

  async function toggle(p: Proof) {
    if (locked || busy) return;
    setBusy(p.id); setErr(null);
    const { data: r, error } = await supabase.rpc("portal_toggle_pick", { p_token: token, p_proof: p.id });
    setBusy(null);
    if (error) { setErr(error.message.replace(/^.*?: /, "")); return; }
    setData((d) => ({ ...d, proofs: d.proofs.map((x) => (x.id === p.id ? { ...x, picked: r.picked } : x)) }));
  }

  async function submit() {
    if (!confirm(`Submit ${picked.length} photos for your album? You won't be able to change them afterwards.`)) return;
    setBusy("submit"); setErr(null);
    const { error } = await supabase.rpc("portal_submit", { p_token: token });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    setData((d) => ({ ...d, submitted_at: new Date().toISOString() }));
  }

  // keyboard nav in lightbox
  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      const i = shown.findIndex((p) => p.id === view.id);
      if (e.key === "Escape") setView(null);
      if (e.key === "ArrowRight" && i < shown.length - 1) setView(shown[i + 1]);
      if (e.key === "ArrowLeft" && i > 0) setView(shown[i - 1]);
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(view); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, shown]);

  // keep lightbox item in sync after toggle
  useEffect(() => { if (view) setView(data.proofs.find((p) => p.id === view.id) ?? null); }, [data.proofs]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-bg">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <div>
            <div className="text-xs text-muted">Huskky Photography · album selection</div>
            <div className="font-semibold">{data.couple_names}</div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className={`font-medium ${data.limit && picked.length >= data.limit ? "text-accent" : ""}`}>
              {picked.length}{data.limit ? ` / ${data.limit}` : ""} picked
            </span>
            <button className={`btn-ghost py-1 text-xs ${onlyPicked ? "bg-soft" : ""}`} onClick={() => setOnlyPicked(!onlyPicked)}>
              {onlyPicked ? "Show all" : "Show picked"}
            </button>
            {!locked && (
              <button className="btn-primary py-1" disabled={picked.length === 0 || !!busy} onClick={submit}>Submit selection</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {locked ? (
          <div className="card mb-4 bg-green-50 text-sm">
            <strong>Thank you!</strong> Your selection of {picked.length} photos was submitted on{" "}
            {new Date(data.submitted_at!).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}. Our designer will start on your album.
            If you need to change anything, message us on WhatsApp.
          </div>
        ) : data.proofs.length === 0 ? (
          <div className="card text-sm text-muted">Your photos aren&apos;t uploaded here yet — we&apos;ll message you as soon as they&apos;re ready.</div>
        ) : (
          <p className="mb-3 text-sm text-muted">
            Tap a photo to open it, tap the heart to pick it for your album{data.limit ? ` (up to ${data.limit})` : ""}. Submit when you&apos;re happy.
          </p>
        )}
        {err && <p className="mb-3 text-sm text-red-700">{err}</p>}

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shown.map((p) => (
            <div key={p.id} className={`relative aspect-[3/2] overflow-hidden rounded-md bg-line ${p.picked ? "ring-2 ring-accent" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofUrl(p.path)} alt={p.filename} loading="lazy" className="h-full w-full cursor-zoom-in object-cover" onClick={() => setView(p)} />
              {!locked && (
                <button
                  onClick={() => toggle(p)}
                  disabled={busy === p.id}
                  className={`absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-lg shadow ${p.picked ? "bg-accent text-white" : "bg-white/90 text-stone-500"}`}
                  aria-label={p.picked ? "Unpick" : "Pick"}
                >
                  {p.picked ? "♥" : "♡"}
                </button>
              )}
              <span className="absolute bottom-0 left-0 right-0 truncate bg-black/40 px-1.5 py-0.5 text-[10px] text-white">{p.filename}</span>
            </div>
          ))}
        </div>

        {data.gallery_url && (
          <p className="mt-6 text-center text-sm">
            Full gallery: <a href={data.gallery_url} className="text-accent underline" target="_blank">open on Pixieset ↗</a>
          </p>
        )}
      </main>

      {view && (
        <div className="fixed inset-0 z-20 flex flex-col bg-black/95" onClick={() => setView(null)}>
          <div className="flex items-center gap-3 px-4 py-2 text-sm text-white/80" onClick={(e) => e.stopPropagation()}>
            <span className="truncate">{view.filename}</span>
            <span className="ml-auto">{shown.findIndex((p) => p.id === view.id) + 1} / {shown.length}</span>
            {!locked && (
              <button
                onClick={() => toggle(view)}
                className={`rounded-full px-3 py-1 ${view.picked ? "bg-accent text-white" : "bg-white text-stone-800"}`}
              >
                {view.picked ? "♥ Picked" : "♡ Pick"}
              </button>
            )}
            <button className="px-2 text-xl" onClick={() => setView(null)}>×</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proofUrl(view.path)} alt={view.filename} className="min-h-0 flex-1 object-contain" onClick={(e) => e.stopPropagation()} />
          <div className="flex justify-between px-4 py-2 text-white/80" onClick={(e) => e.stopPropagation()}>
            <button className="px-3 py-1" onClick={() => { const i = shown.findIndex((p) => p.id === view.id); if (i > 0) setView(shown[i - 1]); }}>‹ Prev</button>
            <button className="px-3 py-1" onClick={() => { const i = shown.findIndex((p) => p.id === view.id); if (i < shown.length - 1) setView(shown[i + 1]); }}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
