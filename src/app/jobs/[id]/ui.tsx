"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addAssignment, addPayment, advanceStage, deleteEvent, deleteJob, deletePayment, removeAssignment,
  saveIngest, setStage, toggleConfirm, updateJob, upsertEvent,
} from "@/app/actions";
import {
  CREW_LABEL, CREW_ROLES, EVENT_LABEL, EVENT_TYPES, PAYMENT_METHODS, STAGES, STAGE_LABEL, Stage, fmtDate, inr,
} from "@/lib/constants";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Person = { key: string; name: string; role: string; rate: number | null; freelance: boolean };
type Props = { job: any; people: Person[]; isMgmt: boolean; log: { to_stage: string; changed_at: string; by: string }[]; post?: React.ReactNode; album?: React.ReactNode };

export default function JobClient({ job, people, isMgmt, log, post, album }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const stage = job.stage as Stage;
  const idx = STAGES.indexOf(stage);
  const next = STAGES[idx + 1];

  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (r && "error" in r && r.error) setErr(r.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Stage control */}
        <section className="card flex flex-wrap items-center gap-3">
          <div className="text-sm">
            Current stage: <strong>{STAGE_LABEL[stage]}</strong>
          </div>
          {next && (
            <button className="btn-primary" disabled={pending} onClick={() => run(() => advanceStage(job.id, stage))}>
              Move to {STAGE_LABEL[next]} →
            </button>
          )}
          {isMgmt && (
            <select
              className="ml-auto w-auto"
              value={stage}
              onChange={(e) => run(() => setStage(job.id, e.target.value as Stage))}
              disabled={pending}
            >
              {STAGES.map((s) => <option key={s} value={s}>Set: {STAGE_LABEL[s]}</option>)}
            </select>
          )}
          {err && <p className="w-full text-sm text-red-700">{err}</p>}
        </section>

        {/* Events */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Events</h2>
          </div>
          {job.events.length === 0 && <p className="text-sm text-muted">No events yet. Add the first one below.</p>}
          {[...job.events]
            .sort((a: any, b: any) => (a.event_date ?? "9").localeCompare(b.event_date ?? "9"))
            .map((ev: any) => (
              <EventCard key={ev.id} ev={ev} jobId={job.id} people={people} isMgmt={isMgmt} stage={stage} />
            ))}
          {isMgmt && <EventForm jobId={job.id} />}
        </section>

        {post}
        {album}
      </div>

      <div className="space-y-6">
        {/* Delivery dates */}
        <section className="card text-sm">
          <h2 className="mb-2 font-semibold">Delivery</h2>
          <Row k="Photos due" v={fmtDate(job.photos_due)} />
          <Row k="Film due" v={fmtDate(job.film_due)} />
          <Row k="Album approval due" v={fmtDate(job.album_due)} />
          <p className="mt-2 text-xs text-muted">Auto-set from the last event date (7 working days / 30 / 30). Edit below to override.</p>
        </section>

        {/* Package */}
        <JobEdit job={job} isMgmt={isMgmt} />

        {/* Payments */}
        <section className="card text-sm">
          <h2 className="mb-2 font-semibold">Payments</h2>
          <ul className="divide-y divide-line">
            {job.payments.map((p: any) => (
              <li key={p.id} className="flex items-center gap-2 py-1.5">
                <span className="w-20 text-muted">{fmtDate(p.received_on)}</span>
                <span className="font-medium">{inr(p.amount)}</span>
                <span className="text-xs uppercase text-muted">{p.method}</span>
                {p.note && <span className="text-xs text-muted">· {p.note}</span>}
                {isMgmt && (
                  <button className="btn-danger ml-auto px-1 py-0 text-xs" onClick={() => run(() => deletePayment(job.id, p.id))}>×</button>
                )}
              </li>
            ))}
            {job.payments.length === 0 && <li className="py-1.5 text-muted">No payments recorded.</li>}
          </ul>
          {isMgmt && <PaymentForm jobId={job.id} />}
        </section>

        {/* History */}
        <section className="card text-sm">
          <h2 className="mb-2 font-semibold">History</h2>
          <ul className="space-y-1 text-xs text-muted">
            {log.map((l, i) => (
              <li key={i}>
                {new Date(l.changed_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} — {STAGE_LABEL[l.to_stage as Stage]} by {l.by}
              </li>
            ))}
          </ul>
        </section>

        {isMgmt && (
          <button
            className="btn-danger w-full text-xs"
            disabled={pending}
            onClick={() => { if (confirm(`Delete job "${job.title}" and everything in it? This cannot be undone.`)) run(() => deleteJob(job.id)); }}
          >
            Delete this job
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}

/* ---------- Event card ---------- */
function EventCard({ ev, jobId, people, isMgmt, stage }: { ev: any; jobId: string; people: Person[]; isMgmt: boolean; stage: Stage }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const ingest = Array.isArray(ev.ingest_logs) ? ev.ingest_logs[0] : ev.ingest_logs;
  const showIngest = STAGES.indexOf(stage) >= STAGES.indexOf("scheduled");

  if (edit) return <EventForm jobId={jobId} ev={ev} onDone={() => setEdit(false)} />;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{ev.type === "other" && ev.custom_name ? ev.custom_name : EVENT_LABEL[ev.type]}</span>
        <span className="text-sm">{fmtDate(ev.event_date)}</span>
        {ev.start_time && <span className="text-sm text-muted">{ev.start_time.slice(0, 5)}{ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ""}</span>}
        {ev.call_time && <span className="text-xs text-muted">call {ev.call_time.slice(0, 5)}</span>}
        <span className="text-sm text-muted">{ev.venue}{ev.city ? `, ${ev.city}` : ""}</span>
        {ev.map_url && <a href={ev.map_url} target="_blank" className="text-xs text-accent hover:underline">Map ↗</a>}
        {ev.overnight && <span className="chip bg-soft">overnight</span>}
        {isMgmt && (
          <span className="ml-auto flex gap-2 text-xs">
            <button className="text-muted hover:text-fg" onClick={() => setEdit(true)}>Edit</button>
            <button className="text-red-700" onClick={() => { if (confirm("Delete this event?")) start(() => deleteEvent(jobId, ev.id)); }}>Delete</button>
          </span>
        )}
      </div>
      {ev.crew_notes && <p className="text-sm"><span className="text-muted">Crew required: </span>{ev.crew_notes}</p>}
      {ev.notes && <p className="text-sm text-muted">{ev.notes}</p>}

      {/* Crew */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Crew</div>
        <ul className="space-y-1 text-sm">
          {ev.assignments.map((a: any) => (
            <li key={a.id} className="flex items-center gap-2">
              <span className="w-36 text-muted">{CREW_LABEL[a.role]}</span>
              <span className="font-medium">{a.profiles?.full_name ?? a.crew_invites?.full_name}</span>
              {a.pay_amount != null && <span className="text-xs text-muted">{inr(a.pay_amount)}</span>}
              <button
                className={`chip ${a.confirmed ? "bg-green-100 text-green-800" : "border border-line text-muted"}`}
                onClick={() => start(() => toggleConfirm(jobId, a.id, !a.confirmed))}
                disabled={pending}
              >
                {a.confirmed ? "confirmed" : "unconfirmed"}
              </button>
              {isMgmt && <button className="btn-danger ml-auto px-1 py-0 text-xs" onClick={() => start(() => removeAssignment(jobId, a.id))}>×</button>}
            </li>
          ))}
          {ev.assignments.length === 0 && <li className="text-sm text-red-700">No crew assigned</li>}
        </ul>
        {isMgmt && <AssignForm jobId={jobId} eventId={ev.id} people={people} onError={setErr} />}
        {err && <p className="text-xs text-red-700">{err}</p>}
      </div>

      {/* Ingest */}
      {showIngest && <IngestForm jobId={jobId} eventId={ev.id} ingest={ingest} />}
    </div>
  );
}

function EventForm({ jobId, ev, onDone }: { jobId: string; ev?: any; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (p: any, fd: FormData) => {
    const r = await upsertEvent(p, fd);
    if (r.ok) onDone?.();
    return r;
  }, null);
  const [type, setType] = useState(ev?.type ?? "muhurtham");
  return (
    <form action={action} className="card space-y-3 border-dashed">
      <input type="hidden" name="job_id" value={jobId} />
      {ev && <input type="hidden" name="id" value={ev.id} />}
      <div className="text-sm font-medium">{ev ? "Edit event" : "Add event"}</div>
      <div className="grid gap-2 md:grid-cols-4">
        <div>
          <label className="f">Type</label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
          </select>
        </div>
        {type === "other" && (
          <div>
            <label className="f">Name</label>
            <input name="custom_name" defaultValue={ev?.custom_name ?? ""} placeholder="Haldi, Mehendi…" />
          </div>
        )}
        <div>
          <label className="f">Date</label>
          <input name="event_date" type="date" defaultValue={ev?.event_date ?? ""} required />
        </div>
        <div>
          <label className="f">Start</label>
          <input name="start_time" type="time" defaultValue={ev?.start_time?.slice(0, 5) ?? ""} />
        </div>
        <div>
          <label className="f">End</label>
          <input name="end_time" type="time" defaultValue={ev?.end_time?.slice(0, 5) ?? ""} />
        </div>
        <div>
          <label className="f">Call time</label>
          <input name="call_time" type="time" defaultValue={ev?.call_time?.slice(0, 5) ?? ""} />
        </div>
        <div className="md:col-span-2">
          <label className="f">Venue</label>
          <input name="venue" defaultValue={ev?.venue ?? ""} required />
        </div>
        <div>
          <label className="f">City</label>
          <input name="city" defaultValue={ev?.city ?? ""} />
        </div>
        <div className="md:col-span-3">
          <label className="f">Google Maps location (paste link)</label>
          <input name="map_url" type="url" defaultValue={ev?.map_url ?? ""} placeholder="https://maps.app.goo.gl/..." />
        </div>
        <div>
          <label className="f">Travel cost (₹)</label>
          <input name="travel_cost" type="number" min={0} defaultValue={ev?.travel_cost ?? 0} />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <input type="checkbox" name="overnight" defaultChecked={ev?.overnight} id={`ov-${ev?.id ?? "new"}`} />
          <label htmlFor={`ov-${ev?.id ?? "new"}`} className="text-sm">Overnight stay</label>
        </div>
        <div className="md:col-span-4">
          <label className="f">Photographer crew required (free text, differs per event)</label>
          <input name="crew_notes" defaultValue={ev?.crew_notes ?? ""} placeholder="e.g. 2 candid + 1 traditional + drone, 1 cinematographer" />
        </div>
        <div className="md:col-span-4">
          <label className="f">Notes</label>
          <input name="notes" defaultValue={ev?.notes ?? ""} />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex justify-end gap-2">
        {onDone && <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>}
        <button className="btn-primary" disabled={pending}>{ev ? "Save" : "Add event"}</button>
      </div>
    </form>
  );
}

function AssignForm({ jobId, eventId, people, onError }: { jobId: string; eventId: string; people: Person[]; onError: (e: string | null) => void }) {
  const [, action, pending] = useActionState(async (_: any, fd: FormData) => {
    const r = await addAssignment(_, fd);
    onError(r.error ?? null);
    return r;
  }, null);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="event_id" value={eventId} />
      <div className="min-w-40">
        <select name="role" defaultValue="lead_photographer">
          {CREW_ROLES.map((r) => <option key={r} value={r}>{CREW_LABEL[r]}</option>)}
        </select>
      </div>
      <div className="min-w-44">
        <select name="person" defaultValue="">
          <option value="" disabled>Pick person…</option>
          {people.map((p) => (
            <option key={p.key} value={p.key}>{p.name}{p.freelance ? " (freelance)" : ""}</option>
          ))}
        </select>
      </div>
      <div className="w-28">
        <input name="pay_amount" type="number" min={0} placeholder="Pay ₹" />
      </div>
      <button className="btn-ghost" disabled={pending}>Assign</button>
    </form>
  );
}

function IngestForm({ jobId, eventId, ingest }: { jobId: string; eventId: string; ingest: any }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (p: any, fd: FormData) => {
    const r = await saveIngest(p, fd);
    if (r.ok) setOpen(false);
    return r;
  }, null);
  if (!open)
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Ingest</span>
        {ingest?.confirmed ? (
          <span className="chip bg-green-100 text-green-800">confirmed · {ingest.card_count ?? "?"} cards · {ingest.file_count ?? "?"} files</span>
        ) : (
          <span className="chip border border-line text-muted">not confirmed</span>
        )}
        <button className="text-xs text-muted hover:text-fg" onClick={() => setOpen(true)}>{ingest ? "Edit" : "Log ingest"}</button>
      </div>
    );
  return (
    <form action={action} className="rounded-lg border border-dashed border-line p-3">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="event_id" value={eventId} />
      <div className="grid gap-2 md:grid-cols-4">
        <div><label className="f">Cards</label><input name="card_count" type="number" defaultValue={ingest?.card_count ?? ""} /></div>
        <div><label className="f">Files</label><input name="file_count" type="number" defaultValue={ingest?.file_count ?? ""} /></div>
        <div><label className="f">Primary drive</label><input name="primary_drive" defaultValue={ingest?.primary_drive ?? ""} /></div>
        <div><label className="f">Backup drive</label><input name="backup_drive" defaultValue={ingest?.backup_drive ?? ""} /></div>
        <div className="md:col-span-3"><label className="f">Notes</label><input name="notes" defaultValue={ingest?.notes ?? ""} /></div>
        <div className="flex items-end gap-2 pb-2">
          <input type="checkbox" name="confirmed" id={`ing-${eventId}`} defaultChecked={ingest?.confirmed} />
          <label htmlFor={`ing-${eventId}`} className="text-sm">Both copies done</label>
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-primary" disabled={pending}>Save</button>
      </div>
    </form>
  );
}

function PaymentForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(addPayment, null);
  return (
    <form action={action} className="mt-3 grid grid-cols-2 gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <input name="amount" type="number" min={1} placeholder="Amount ₹" required />
      <select name="method" defaultValue="upi">
        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
      </select>
      <input name="received_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      <input name="note" placeholder="Note" />
      {state?.error && <p className="col-span-2 text-xs text-red-700">{state.error}</p>}
      <button className="btn-ghost col-span-2" disabled={pending}>Record payment</button>
    </form>
  );
}

function JobEdit({ job, isMgmt }: { job: any; isMgmt: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (p: any, fd: FormData) => {
    const r = await updateJob(p, fd);
    if (r.ok) setOpen(false);
    return r;
  }, null);
  if (!open)
    return (
      <section className="card text-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Package</h2>
          {isMgmt && <button className="text-xs text-muted hover:text-fg" onClick={() => setOpen(true)}>Edit</button>}
        </div>
        <p className="whitespace-pre-wrap">{job.package_summary || <span className="text-muted">—</span>}</p>
        {job.album_photo_count && <p className="mt-1 text-muted">Album: {job.album_photo_count} photos · {job.revision_rounds_included} revision rounds</p>}
        {job.pixieset_url && <a href={job.pixieset_url} target="_blank" className="mt-1 block text-accent hover:underline">Pixieset ↗</a>}
        {job.notes && <p className="mt-2 text-xs text-muted">{job.notes}</p>}
      </section>
    );
  return (
    <form action={action} className="card space-y-2 text-sm">
      <input type="hidden" name="id" value={job.id} />
      <div><label className="f">Title</label><input name="title" defaultValue={job.title} /></div>
      <div><label className="f">Package summary</label><textarea name="package_summary" rows={3} defaultValue={job.package_summary ?? ""} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="f">Total ₹</label><input name="total_amount" type="number" defaultValue={job.total_amount} /></div>
        <div><label className="f">Album photos</label><input name="album_photo_count" type="number" defaultValue={job.album_photo_count ?? ""} /></div>
        <div><label className="f">Photos due</label><input name="photos_due" type="date" defaultValue={job.photos_due ?? ""} /></div>
        <div><label className="f">Film due</label><input name="film_due" type="date" defaultValue={job.film_due ?? ""} /></div>
        <div><label className="f">Album due</label><input name="album_due" type="date" defaultValue={job.album_due ?? ""} /></div>
      </div>
      <div><label className="f">Pixieset link</label><input name="pixieset_url" defaultValue={job.pixieset_url ?? ""} /></div>
      <div><label className="f">Notes</label><textarea name="notes" rows={2} defaultValue={job.notes ?? ""} /></div>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-primary" disabled={pending}>Save</button>
      </div>
    </form>
  );
}
