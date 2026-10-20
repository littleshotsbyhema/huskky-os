"use client";

import { useState, useTransition } from "react";
import {
  claimJob, seedTasks, setGalleryUrl, setSelectionReceived, setTaskAssignee, setTaskStatus,
} from "@/app/actions";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Task = { id: string; track: string; key: string; label: string; sort: number; status: string; assignee_id: string | null; profiles: { full_name: string } | null };
type Props = { job: any; tasks: Task[]; team: { id: string; full_name: string }[]; meId: string; isMgmt: boolean; origin: string };

const STATUS_NEXT: Record<string, "todo" | "in_progress" | "done"> = { todo: "in_progress", in_progress: "done", done: "todo" };
const STATUS_CHIP: Record<string, string> = {
  todo: "border border-line text-muted",
  in_progress: "bg-soft text-fg",
  done: "bg-green-100 text-green-800",
};

export default function PostPanel({ job, tasks, team, meId, isMgmt }: Props) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => { setErr(null); const r = await fn(); if (r && "error" in r && r.error) setErr(r.error); });

  const photo = tasks.filter((t) => t.track === "photo").sort((a, b) => a.sort - b.sort);
  const video = tasks.filter((t) => t.track === "video").sort((a, b) => a.sort - b.sort);

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

      {/* Album selection (done in Pixieset) */}
      <SelectionCard job={job} isMgmt={isMgmt} />

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

function SelectionCard({ job, isMgmt }: { job: any; isMgmt: boolean }) {
  const [url, setUrl] = useState<string>(job.selection_url ?? "");
  const [pending, start] = useTransition();
  const received = !!job.selection_received_at;
  const hasAlbum = (job.deliverables?.albums?.length ?? 0) > 0;
  return (
    <div className="card space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">Album selection (Pixieset)</h3>
        {!hasAlbum && <span className="text-xs text-muted">no physical album in this package</span>}
        {received ? (
          <span className="chip bg-green-100 text-green-800">received {new Date(job.selection_received_at + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        ) : (
          <span className="chip bg-soft">waiting for client{job.album_photo_count ? ` · ${job.album_photo_count} photos` : ""}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pixieset favourites / selection link" className="flex-1 min-w-60" />
        {received ? (
          isMgmt && <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await setSelectionReceived(job.id, false, url || null); })}>Mark not received</button>
        ) : (
          <button className="btn-primary" disabled={pending} onClick={() => start(async () => { await setSelectionReceived(job.id, true, url || null); })}>Selection received ✓</button>
        )}
        {job.selection_url && <a href={job.selection_url} target="_blank" className="text-accent hover:underline">Open ↗</a>}
      </div>
      <p className="text-xs text-muted">The client picks their album photos in Pixieset. Tick this when their favourites are in — it unlocks the Album stage.</p>
    </div>
  );
}
