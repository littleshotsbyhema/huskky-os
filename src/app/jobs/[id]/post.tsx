"use client";

import { useRef, useState, useTransition } from "react";
import {
  claimJob, clearProofs, deleteProof, registerProofs, reopenSelection, seedTasks, setGalleryUrl, setTaskAssignee, setTaskStatus,
} from "@/app/actions";
import { createBrowser, proofUrl } from "@/lib/supabase/browser";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Task = { id: string; track: string; key: string; label: string; sort: number; status: string; assignee_id: string | null; profiles: { full_name: string } | null };
type Proof = { id: string; path: string; filename: string; picked: boolean };
type Props = { job: any; tasks: Task[]; proofs: Proof[]; team: { id: string; full_name: string }[]; meId: string; isMgmt: boolean; origin: string };

const STATUS_NEXT: Record<string, "todo" | "in_progress" | "done"> = { todo: "in_progress", in_progress: "done", done: "todo" };
const STATUS_CHIP: Record<string, string> = {
  todo: "border border-line text-muted",
  in_progress: "bg-soft text-fg",
  done: "bg-green-100 text-green-800",
};

export default function PostPanel({ job, tasks, proofs, team, meId, isMgmt, origin }: Props) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => { setErr(null); const r = await fn(); if (r && "error" in r && r.error) setErr(r.error); });

  const photo = tasks.filter((t) => t.track === "photo").sort((a, b) => a.sort - b.sort);
  const video = tasks.filter((t) => t.track === "video").sort((a, b) => a.sort - b.sort);
  const picked = proofs.filter((p) => p.picked);
  const portalLink = `${origin}/portal/${job.portal_token}`;

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Post-production</h2>
      {err && <p className="text-sm text-red-700">{err}</p>}

      {tasks.length === 0 ? (
        <div className="card text-sm">
          <p className="text-muted">No tasks yet — they're created when the job enters Post-production.</p>
          <button className="btn-ghost mt-2" disabled={pending} onClick={() => run(() => seedTasks(job.id))}>Create tasks now</button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <TaskList title="Photos" tasks={photo} track="photo" />
          <TaskList title="Film" tasks={video} track="video" />
        </div>
      )}

      {/* Proofs + client selection */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold">Album selection</h3>
          <span className="text-xs text-muted">
            {proofs.length} proofs · {picked.length}{job.album_photo_count ? ` / ${job.album_photo_count}` : ""} picked
          </span>
          {job.selection_submitted_at ? (
            <span className="chip bg-green-100 text-green-800">
              submitted {new Date(job.selection_submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          ) : proofs.length > 0 ? (
            <span className="chip bg-soft">waiting for client</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input readOnly value={portalLink} className="flex-1 min-w-60 text-xs" onFocus={(e) => e.target.select()} />
          <CopyButton text={portalLink} />
          <a
            className="btn-ghost"
            target="_blank"
            href={`https://wa.me/${(job.clients?.phone ?? "").replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(`Hi ${job.clients?.couple_names}! Your photos are ready for album selection. Please pick your favourites here: ${portalLink}`)}`}
          >
            WhatsApp
          </a>
        </div>

        <Uploader jobId={job.id} onError={setErr} />

        {proofs.length > 0 && (
          <>
            <ProofGrid proofs={proofs} jobId={job.id} canDelete={!job.selection_submitted_at} />
            <div className="flex flex-wrap gap-2 text-xs">
              {picked.length > 0 && <CopyButton text={picked.map((p) => p.filename).join("\n")} label={`Copy ${picked.length} picked filenames`} />}
              {job.selection_submitted_at && isMgmt && (
                <button className="btn-ghost" disabled={pending} onClick={() => run(() => reopenSelection(job.id))}>Reopen selection</button>
              )}
              {isMgmt && (
                <button className="btn-danger" disabled={pending} onClick={() => { if (confirm("Remove all proofs and reset the selection?")) run(() => clearProofs(job.id)); }}>
                  Clear all proofs
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Gallery link */}
      <GalleryUrl jobId={job.id} value={job.gallery_url} />
    </section>
  );

  function TaskList({ title, tasks, track }: { title: string; tasks: Task[]; track: "photo" | "video" }) {
    const mine = tasks.every((t) => t.assignee_id === meId);
    return (
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          {!mine && (
            <button className="text-xs text-accent hover:underline" disabled={pending} onClick={() => run(() => claimJob(job.id, track))}>
              Claim {title.toLowerCase()}
            </button>
          )}
        </div>
        <ul className="space-y-1.5 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <button
                className={`chip w-24 ${STATUS_CHIP[t.status]}`}
                disabled={pending}
                onClick={() => run(() => setTaskStatus(job.id, t.id, STATUS_NEXT[t.status]))}
                title="Click to advance"
              >
                {t.status.replace("_", " ")}
              </button>
              <span className={t.status === "done" ? "text-muted line-through" : ""}>{t.label}</span>
              <select
                className="ml-auto w-auto py-0.5 text-xs"
                value={t.assignee_id ?? ""}
                disabled={pending}
                onChange={(e) => run(() => setTaskAssignee(job.id, t.id, e.target.value || null))}
              >
                <option value="">—</option>
                {team.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}

function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn-ghost"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}
    >
      {ok ? "Copied" : label}
    </button>
  );
}

/** Resize to max 1600px on the long edge, JPEG q0.82, then upload straight to Supabase Storage. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const max = 1600;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.82));
}

function Uploader({ jobId, onError }: { jobId: string; onError: (e: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<string | null>(null);
  const [, start] = useTransition();

  async function upload(files: FileList) {
    const supabase = createBrowser();
    const list = Array.from(files).filter((f) => /^image\//.test(f.type));
    if (!list.length) return;
    onError(null);
    const done: { path: string; filename: string }[] = [];
    for (let i = 0; i < list.length; i++) {
      setProg(`Uploading ${i + 1} / ${list.length}…`);
      const f = list[i];
      try {
        const blob = await shrink(f);
        const path = `${jobId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("proofs").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        done.push({ path, filename: f.name.replace(/\.[^.]+$/, "") });
      } catch (e: any) {
        onError(`Failed on ${f.name}: ${e.message ?? e}`);
        break;
      }
    }
    setProg(done.length ? "Saving…" : null);
    if (done.length) start(async () => { const r = await registerProofs(jobId, done); if (r.error) onError(r.error); setProg(null); });
    else setProg(null);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      <button className="btn-ghost" onClick={() => ref.current?.click()} disabled={!!prog}>{prog ?? "Upload proofs"}</button>
      <span className="text-xs text-muted">JPEGs are resized to 1600px in the browser before upload. Filenames are kept so you can match them back to the originals.</span>
    </div>
  );
}

function ProofGrid({ proofs, jobId, canDelete }: { proofs: Proof[]; jobId: string; canDelete: boolean }) {
  const [, start] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? proofs : proofs.slice(0, 24);
  return (
    <div>
      <div className="grid grid-cols-4 gap-1 md:grid-cols-6 lg:grid-cols-8">
        {list.map((p) => (
          <div key={p.id} className={`group relative aspect-square overflow-hidden rounded ${p.picked ? "ring-2 ring-accent" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofUrl(p.path)} alt={p.filename} loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1 text-[10px] text-white">{p.filename}</span>
            {p.picked && <span className="absolute left-1 top-1 rounded-full bg-accent px-1 text-[10px] text-white">♥</span>}
            {canDelete && (
              <button
                className="absolute right-1 top-1 hidden rounded bg-black/60 px-1 text-[10px] text-white group-hover:block"
                onClick={() => start(() => deleteProof(jobId, p.id, p.path))}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {proofs.length > 24 && (
        <button className="mt-2 text-xs text-muted hover:text-fg" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${proofs.length}`}
        </button>
      )}
    </div>
  );
}

function GalleryUrl({ jobId, value }: { jobId: string; value: string | null }) {
  const [v, setV] = useState(value ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">Final gallery (Pixieset)</span>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://....pixieset.com/..." className="flex-1 min-w-60" />
      <button className="btn-ghost" disabled={pending || v === (value ?? "")} onClick={() => start(async () => { await setGalleryUrl(jobId, v || null); })}>Save</button>
      {value && <a href={value} target="_blank" className="text-accent hover:underline">Open ↗</a>}
    </div>
  );
}
