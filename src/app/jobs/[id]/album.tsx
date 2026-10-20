"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  createAlbumVersion, deleteAlbumVersion, deletePrintOrder, markReviewRequested, saveDelivery, sendAlbumVersion,
  teamAlbumComment, teamApproveAlbum, upsertPrintOrder,
} from "@/app/actions";
import { createBrowser } from "@/lib/supabase/browser";
import { fmtDate, inr } from "@/lib/constants";

/* eslint-disable @typescript-eslint/no-explicit-any */
type File_ = { path: string; name: string; type: string };
type Version = { id: string; version: number; status: string; files: File_[]; note: string | null; sent_at: string | null; decided_at: string | null; created_at: string; album_comments: any[] };
type Props = { job: any; versions: Version[]; printOrders: any[]; delivery: any; isMgmt: boolean; origin: string; reviewUrl: string };

export const albumUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/albums/${path}`;

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "draft (not sent)", cls: "border border-line text-muted" },
  sent: { label: "with client", cls: "bg-soft" },
  changes_requested: { label: "changes requested", cls: "bg-red-100 text-red-800" },
  approved: { label: "approved", cls: "bg-green-100 text-green-800" },
};

export default function AlbumPanel({ job, versions, printOrders, delivery, isMgmt, origin, reviewUrl }: Props) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => { setErr(null); const r = await fn(); if (r && "error" in r && r.error) setErr(r.error); });

  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const latest = sorted[0];
  const rounds = Math.max(0, versions.length - 1);
  const extra = Math.max(0, rounds - (job.revision_rounds_included ?? 2));
  const portalLink = `${origin}/portal/${job.portal_token}`;
  const wa = (text: string) =>
    `https://wa.me/${(job.clients?.phone ?? "").replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(text)}`;

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Album</h2>
      {err && <p className="text-sm text-red-700">{err}</p>}

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{versions.length} draft{versions.length === 1 ? "" : "s"}</span>
          <span className="text-muted">· {rounds} revision round{rounds === 1 ? "" : "s"} of {job.revision_rounds_included} included</span>
          {extra > 0 && <span className="chip bg-red-100 text-red-800">{extra} extra round{extra > 1 ? "s" : ""} — chargeable</span>}
          {job.album_approved_at && <span className="chip bg-green-100 text-green-800">approved {fmtDate(job.album_approved_at.slice(0, 10))}</span>}
        </div>

        {!job.album_approved_at && (
          <VersionUploader jobId={job.id} nextVersion={(latest?.version ?? 0) + 1} onError={setErr} />
        )}

        {sorted.map((v) => (
          <VersionCard
            key={v.id}
            v={v}
            job={job}
            isLatest={v.id === latest?.id}
            isMgmt={isMgmt}
            pending={pending}
            run={run}
            waLink={wa(`Hi ${job.clients?.couple_names}! Your album draft (v${v.version}) is ready to review. Open it here, add comments on any page, and approve when you're happy: ${portalLink}`)}
          />
        ))}
      </div>

      <PrintOrders jobId={job.id} orders={printOrders} isMgmt={isMgmt} />

      <Delivery
        jobId={job.id}
        delivery={delivery}
        reviewLink={reviewUrl}
        waReview={wa(`Thank you for choosing Huskky Photography, ${job.clients?.couple_names}! If you enjoyed working with us, a quick Google review would mean a lot: ${reviewUrl}`)}
        waDelivered={wa(`Hi ${job.clients?.couple_names}! Everything is delivered. Please confirm you've received it here: ${portalLink}`)}
      />
    </section>
  );
}

function VersionCard({ v, job, isLatest, isMgmt, pending, run, waLink }: { v: Version; job: any; isLatest: boolean; isMgmt: boolean; pending: boolean; run: (fn: () => Promise<any>) => void; waLink: string }) {
  const [body, setBody] = useState("");
  const [page, setPage] = useState("");
  const st = STATUS[v.status];
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">v{v.version}</span>
        <span className={`chip ${st.cls}`}>{st.label}</span>
        <span className="text-xs text-muted">{fmtDate(v.created_at.slice(0, 10))}{v.sent_at ? ` · sent ${fmtDate(v.sent_at.slice(0, 10))}` : ""}</span>
        {v.note && <span className="text-xs text-muted">· {v.note}</span>}
        <span className="ml-auto flex gap-2">
          {v.status === "draft" && isLatest && (
            <button className="btn-primary py-1 text-xs" disabled={pending} onClick={() => run(() => sendAlbumVersion(job.id, v.id))}>Send to client</button>
          )}
          {v.status !== "draft" && v.status !== "approved" && (
            <a className="btn-ghost py-1 text-xs" href={waLink} target="_blank">WhatsApp</a>
          )}
          {(v.status === "sent" || v.status === "changes_requested") && isMgmt && isLatest && (
            <button className="btn-ghost py-1 text-xs" disabled={pending} onClick={() => { if (confirm("Mark this version approved on the client's behalf?")) run(() => teamApproveAlbum(job.id, v.id)); }}>Approve (on behalf)</button>
          )}
          {v.status === "draft" && isMgmt && (
            <button className="btn-danger py-1 text-xs" disabled={pending} onClick={() => { if (confirm(`Delete v${v.version}?`)) run(() => deleteAlbumVersion(job.id, v.id, v.files.map((f) => f.path))); }}>Delete</button>
          )}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {v.files.map((f) => (
          <a key={f.path} href={albumUrl(f.path)} target="_blank" className="chip border border-line hover:border-accent">{f.type.startsWith("image/") ? "🖼" : "📄"} {f.name}</a>
        ))}
      </div>
      {v.album_comments.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-2">
          {v.album_comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className={`shrink-0 text-xs ${c.author === "client" ? "text-accent" : "text-muted"}`}>{c.author === "client" ? "Client" : c.author_name ?? "Team"}{c.page ? ` · p${c.page}` : ""}</span>
              <span>{c.body}</span>
            </li>
          ))}
        </ul>
      )}
      {v.status !== "approved" && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return; run(async () => { const r = await teamAlbumComment(job.id, v.id, page ? Number(page) : null, body.trim()); if (!r.error) { setBody(""); setPage(""); } return r; }); }}
        >
          <input value={page} onChange={(e) => setPage(e.target.value)} placeholder="p#" className="w-16" />
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply / note for the client…" className="flex-1" />
          <button className="btn-ghost" disabled={pending || !body.trim()}>Add</button>
        </form>
      )}
    </div>
  );
}

function VersionUploader({ jobId, nextVersion, onError }: { jobId: string; nextVersion: number; onError: (e: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [prog, setProg] = useState<string | null>(null);
  const [, start] = useTransition();

  async function upload(files: FileList) {
    const supabase = createBrowser();
    const list = Array.from(files).filter((f) => f.type === "application/pdf" || /^image\//.test(f.type));
    if (!list.length) return onError("Pick a PDF or JPEG/PNG spreads.");
    onError(null);
    const done: { path: string; name: string; type: string }[] = [];
    for (let i = 0; i < list.length; i++) {
      setProg(`Uploading ${i + 1}/${list.length}…`);
      const f = list[i];
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${jobId}/v${nextVersion}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("albums").upload(path, f, { contentType: f.type, upsert: false });
      if (error) { onError(`Failed on ${f.name}: ${error.message}`); break; }
      done.push({ path, name: f.name, type: f.type });
    }
    setProg(done.length ? "Saving…" : null);
    if (done.length) start(async () => { const r = await createAlbumVersion(jobId, done, note || null); if (r.error) onError(r.error); setProg(null); setNote(""); });
    else setProg(null);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line p-3 text-sm">
      <input ref={ref} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      <span className="font-medium">New draft v{nextVersion}</span>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. fixed p4 crop, swapped cover)" className="flex-1 min-w-48" />
      <button className="btn-ghost" onClick={() => ref.current?.click()} disabled={!!prog}>{prog ?? "Upload PDF / spreads"}</button>
      <span className="w-full text-xs text-muted">One PDF (up to 50 MB) or JPEG spreads. It stays a draft until you press “Send to client”.</span>
    </div>
  );
}

function PrintOrders({ jobId, orders, isMgmt }: { jobId: string; orders: any[]; isMgmt: boolean }) {
  const [edit, setEdit] = useState<any | null | "new">(null);
  const [, start] = useTransition();
  return (
    <div className="card space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Print orders</h3>
        {isMgmt && edit === null && <button className="text-xs text-accent hover:underline" onClick={() => setEdit("new")}>+ Add order</button>}
      </div>
      {orders.length === 0 && edit === null && <p className="text-muted">No print order yet.</p>}
      <ul className="divide-y divide-line">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            <span className="font-medium">{o.vendor ?? "—"}</span>
            {o.order_ref && <span className="text-muted">#{o.order_ref}</span>}
            <span className="text-muted">{o.description}</span>
            <span className="text-xs text-muted">ordered {fmtDate(o.ordered_on)} · expected {fmtDate(o.expected_on)}</span>
            {o.received_on ? <span className="chip bg-green-100 text-green-800">received {fmtDate(o.received_on)}</span> : <span className="chip bg-soft">awaiting</span>}
            {o.cost != null && <span className="text-xs">{inr(o.cost)}</span>}
            {isMgmt && (
              <span className="ml-auto flex gap-2 text-xs">
                <button className="text-muted hover:text-fg" onClick={() => setEdit(o)}>Edit</button>
                <button className="text-red-700" onClick={() => { if (confirm("Delete this print order?")) start(() => deletePrintOrder(jobId, o.id)); }}>Delete</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {edit !== null && <PrintOrderForm jobId={jobId} row={edit === "new" ? undefined : edit} onDone={() => setEdit(null)} />}
    </div>
  );
}

function PrintOrderForm({ jobId, row, onDone }: { jobId: string; row?: any; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (p: any, fd: FormData) => { const r = await upsertPrintOrder(p, fd); if (r.ok) onDone(); return r; }, null);
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-dashed border-line p-3 md:grid-cols-4">
      <input type="hidden" name="job_id" value={jobId} />
      {row && <input type="hidden" name="id" value={row.id} />}
      <div><label className="f">Vendor</label><input name="vendor" defaultValue={row?.vendor ?? ""} /></div>
      <div><label className="f">Order ref</label><input name="order_ref" defaultValue={row?.order_ref ?? ""} /></div>
      <div className="md:col-span-2"><label className="f">What</label><input name="description" defaultValue={row?.description ?? ""} placeholder="12x36 40 sheets + 2 mini albums" /></div>
      <div><label className="f">Ordered on</label><input name="ordered_on" type="date" defaultValue={row?.ordered_on ?? new Date().toISOString().slice(0, 10)} /></div>
      <div><label className="f">Expected</label><input name="expected_on" type="date" defaultValue={row?.expected_on ?? ""} /></div>
      <div><label className="f">Received</label><input name="received_on" type="date" defaultValue={row?.received_on ?? ""} /></div>
      <div><label className="f">Cost ₹</label><input name="cost" type="number" min={0} defaultValue={row?.cost ?? ""} /></div>
      <div className="md:col-span-4"><label className="f">Notes</label><input name="notes" defaultValue={row?.notes ?? ""} /></div>
      {state?.error && <p className="text-sm text-red-700 md:col-span-4">{state.error}</p>}
      <div className="flex justify-end gap-2 md:col-span-4">
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={pending}>Save</button>
      </div>
    </form>
  );
}

function Delivery({ jobId, delivery, reviewLink, waReview, waDelivered }: { jobId: string; delivery: any; reviewLink: string; waReview: string; waDelivered: string }) {
  const [state, action, pending] = useActionState(saveDelivery, null);
  const [, start] = useTransition();
  const d = delivery ?? {};
  return (
    <form action={action} className="card space-y-3 text-sm">
      <input type="hidden" name="job_id" value={jobId} />
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Delivery</h3>
        {d.client_confirmed_at && <span className="chip bg-green-100 text-green-800">client confirmed {fmtDate(d.client_confirmed_at.slice(0, 10))}</span>}
        {d.review_requested_at && <span className="chip border border-line text-muted">review asked {fmtDate(d.review_requested_at.slice(0, 10))}</span>}
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <div><label className="f">Gallery sent</label><input name="gallery_sent_at" type="date" defaultValue={d.gallery_sent_at ?? ""} /></div>
        <div><label className="f">Film sent</label><input name="film_sent_at" type="date" defaultValue={d.film_sent_at ?? ""} /></div>
        <div><label className="f">Album handed over</label><input name="album_handover_at" type="date" defaultValue={d.album_handover_at ?? ""} /></div>
        <div>
          <label className="f">Album by</label>
          <select name="album_method" defaultValue={d.album_method ?? ""}>
            <option value="">—</option><option value="courier">Courier</option><option value="handover">Hand delivery</option><option value="pickup">Client pickup</option>
          </select>
        </div>
        <div><label className="f">Courier ref</label><input name="courier_ref" defaultValue={d.courier_ref ?? ""} /></div>
        <div><label className="f">Frames / extras</label><input name="frames" defaultValue={d.frames ?? ""} /></div>
        <div className="flex items-end gap-2 pb-2">
          <input type="checkbox" name="pendrive" id="pd" defaultChecked={d.pendrive} /><label htmlFor="pd">Pen drive given</label>
        </div>
        <div className="md:col-span-4"><label className="f">Notes</label><input name="notes" defaultValue={d.notes ?? ""} /></div>
      </div>
      {state?.error && <p className="text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-green-700">Saved.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={pending}>Save delivery</button>
        <a className="btn-ghost" href={waDelivered} target="_blank">Ask client to confirm (WhatsApp)</a>
        {reviewLink ? (
          <a className="btn-ghost" href={waReview} target="_blank" onClick={() => start(() => markReviewRequested(jobId))}>Ask for Google review (WhatsApp)</a>
        ) : (
          <span className="text-xs text-muted">Add your Google review link on the Team page to enable the review ask.</span>
        )}
      </div>
    </form>
  );
}
