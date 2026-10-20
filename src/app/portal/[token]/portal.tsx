"use client";

import { useEffect, useState } from "react";
import { createBrowser, proofUrl } from "@/lib/supabase/browser";

type Proof = { id: string; path: string; filename: string; picked: boolean };
type Comment = { id: string; page: number | null; body: string; author: string; author_name: string | null; created_at: string };
type Album = { id: string; version: number; status: string; files: { path: string; name: string; type: string }[]; note: string | null; sent_at: string | null; comments: Comment[] };
type Delivery = { gallery_sent_at: string | null; film_sent_at: string | null; album_handover_at: string | null; album_method: string | null; courier_ref: string | null; client_confirmed_at: string | null } | null;
type Data = {
  job_id: string; title: string; couple_names: string; limit: number | null;
  submitted_at: string | null; gallery_url: string | null; stage: string; proofs: Proof[];
  album: Album | null; album_approved_at: string | null; rounds_included: number; delivery: Delivery;
  business: { name?: string } | null;
};
const albumUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/albums/${path}`;

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
  const hasAlbum = !!data.album;
  const hasDelivery = ["delivered", "closed"].includes(data.stage);
  const [tab, setTab] = useState<"photos" | "album" | "delivery">(hasDelivery ? "delivery" : hasAlbum && data.album!.status !== "approved" ? "album" : hasAlbum && locked ? "album" : "photos");

  async function refresh() {
    const { data: d } = await supabase.rpc("portal_get", { p_token: token });
    if (d) setData(d);
  }

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
          {tab === "photos" && (
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
          )}
        </div>
        {(hasAlbum || hasDelivery) && (
          <div className="mx-auto flex max-w-6xl gap-1 px-4 pb-2 text-sm">
            {(["photos", "album", "delivery"] as const).filter((t) => t === "photos" || (t === "album" && hasAlbum) || (t === "delivery" && hasDelivery)).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 capitalize ${tab === t ? "bg-accent text-white" : "text-muted hover:text-fg"}`}>
                {t === "photos" ? "Photo selection" : t === "album" ? `Album draft v${data.album?.version}` : "Delivery"}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {tab === "album" && data.album && (
          <AlbumReview album={data.album} token={token} approvedAt={data.album_approved_at} onChange={refresh} />
        )}
        {tab === "delivery" && (
          <DeliveryView d={data.delivery} galleryUrl={data.gallery_url} token={token} onChange={refresh} />
        )}
        {tab !== "photos" ? null : locked ? (
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

        <div className={`grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${tab !== "photos" ? "hidden" : ""}`}>
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

        {tab === "photos" && data.gallery_url && (
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


function AlbumReview({ album, token, approvedAt, onChange }: { album: Album; token: string; approvedAt: string | null; onChange: () => Promise<void> }) {
  const supabase = createBrowser();
  const [page, setPage] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pdf = album.files.find((f) => f.type === "application/pdf");
  const images = album.files.filter((f) => f.type.startsWith("image/"));
  const open = album.status === "sent" || album.status === "changes_requested";
  const myComments = album.comments.filter((c) => c.author === "client");

  async function comment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("portal_album_comment", { p_token: token, p_version: album.id, p_page: page ? Number(page) : null, p_body: body });
    setBusy(false);
    if (error) return setErr(error.message);
    setBody(""); setPage("");
    await onChange();
  }
  async function decide(d: "approve" | "changes") {
    const msg = d === "approve"
      ? "Approve this album design? It will go to print exactly as shown."
      : `Send ${myComments.length} comment${myComments.length === 1 ? "" : "s"} to the designer and request changes?`;
    if (!confirm(msg)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("portal_album_decide", { p_token: token, p_version: album.id, p_decision: d });
    setBusy(false);
    if (error) return setErr(error.message);
    await onChange();
  }

  return (
    <div className="space-y-4">
      {album.status === "approved" ? (
        <div className="card bg-green-50 text-sm"><strong>Approved!</strong> You approved this design{approvedAt ? ` on ${new Date(approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}` : ""}. It's off to print.</div>
      ) : album.status === "changes_requested" ? (
        <div className="card bg-soft/60 text-sm">Thanks — your change requests are with our designer. You'll get a new draft here soon.</div>
      ) : (
        <div className="card text-sm">
          <strong>Review your album draft v{album.version}.</strong> Open it below. Add a comment for anything to change (mention the page number), then either request changes or approve.
          {album.note && <div className="mt-1 text-muted">Designer's note: {album.note}</div>}
        </div>
      )}

      {pdf && (
        <div className="overflow-hidden rounded-xl border border-line bg-black/5">
          <iframe src={albumUrl(pdf.path) + "#view=FitH"} className="h-[70vh] w-full" title="Album draft" />
          <div className="flex justify-end bg-card p-2 text-xs"><a className="text-accent underline" href={albumUrl(pdf.path)} target="_blank">Open PDF in a new tab ↗</a></div>
        </div>
      )}
      {images.length > 0 && (
        <div className="space-y-2">
          {images.map((f, i) => (
            <figure key={f.path} className="overflow-hidden rounded-xl border border-line bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={albumUrl(f.path)} alt={f.name} className="w-full" loading="lazy" />
              <figcaption className="px-3 py-1 text-xs text-muted">Spread {i + 1} · {f.name}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="card space-y-3 text-sm">
        <h3 className="font-semibold">Comments</h3>
        {album.comments.length === 0 && <p className="text-muted">No comments yet.</p>}
        <ul className="space-y-1.5">
          {album.comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className={`shrink-0 text-xs ${c.author === "client" ? "text-accent" : "text-muted"}`}>{c.author === "client" ? "You" : c.author_name ?? "Huskky"}{c.page ? ` · page ${c.page}` : ""}</span>
              <span>{c.body}</span>
            </li>
          ))}
        </ul>
        {open && (
          <form onSubmit={comment} className="flex flex-wrap gap-2">
            <input value={page} onChange={(e) => setPage(e.target.value)} placeholder="Page #" className="w-24" inputMode="numeric" />
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should change?" className="flex-1 min-w-48" />
            <button className="btn-ghost" disabled={busy || !body.trim()}>Add comment</button>
          </form>
        )}
        {err && <p className="text-red-700">{err}</p>}
        {open && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button className="btn-primary" disabled={busy} onClick={() => decide("approve")}>Approve album ✓</button>
            <button className="btn-ghost" disabled={busy || myComments.length === 0} onClick={() => decide("changes")}>Request changes ({myComments.length})</button>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryView({ d, galleryUrl, token, onChange }: { d: Delivery; galleryUrl: string | null; token: string; onChange: () => Promise<void> }) {
  const supabase = createBrowser();
  const [busy, setBusy] = useState(false);
  const fmt = (x: string | null) => (x ? new Date(x + (x.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);
  async function confirmReceipt() {
    if (!confirm("Confirm you have received everything?")) return;
    setBusy(true);
    await supabase.rpc("portal_confirm_delivery", { p_token: token });
    setBusy(false);
    await onChange();
  }
  const rows: [string, string | null][] = [
    ["Online gallery", d?.gallery_sent_at ? `sent ${fmt(d.gallery_sent_at)}` : null],
    ["Wedding film", d?.film_sent_at ? `sent ${fmt(d.film_sent_at)}` : null],
    ["Album", d?.album_handover_at ? `${d.album_method === "courier" ? "couriered" : d.album_method === "pickup" ? "collected" : "handed over"} ${fmt(d.album_handover_at)}${d.courier_ref ? ` · ${d.courier_ref}` : ""}` : null],
  ];
  return (
    <div className="space-y-4">
      <div className="card text-sm">
        <h3 className="mb-2 font-semibold">Your delivery</h3>
        <ul className="space-y-1">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between"><span className="text-muted">{k}</span><span>{v ?? <span className="text-muted">pending</span>}</span></li>
          ))}
        </ul>
        {galleryUrl && <a href={galleryUrl} target="_blank" className="mt-3 block text-accent underline">Open your gallery on Pixieset ↗</a>}
      </div>
      {d?.client_confirmed_at ? (
        <div className="card bg-green-50 text-sm"><strong>Thank you!</strong> You confirmed receipt on {fmt(d.client_confirmed_at)}. It was a joy working with you.</div>
      ) : (
        <button className="btn-primary" disabled={busy} onClick={confirmReceipt}>I've received everything ✓</button>
      )}
    </div>
  );
}
