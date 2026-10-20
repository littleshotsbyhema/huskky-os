import Link from "next/link";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/constants";

export default async function PostQueue() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, job_no, title, stage, photos_due, film_due, album_due, album_photo_count, selection_received_at, deliverables, events(event_date), post_tasks(id, key, track, status, assignee_id, label, sort, done_at, profiles(full_name))")
    .in("stage", ["shot", "post", "album"])
    .order("photos_due", { ascending: true, nullsFirst: false });

  const rows = (jobs ?? []).map((j) => {
    const tasks = (j.post_tasks as any[]) ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const photo = tasks.filter((t) => t.track === "photo");
    const video = tasks.filter((t) => t.track === "video");
    const pct = (ts: typeof tasks) => (ts.length ? Math.round((ts.filter((t) => t.status === "done").length / ts.length) * 100) : 0);
    const next = (ts: typeof tasks) => ts.sort((a, b) => a.sort - b.sort).find((t) => t.status !== "done");
    const people = Array.from(new Set(tasks.map((t) => t.profiles?.full_name).filter(Boolean))) as string[];
    const hasAlbum = (((j.deliverables as { albums?: unknown[] })?.albums) ?? []).length > 0;
    const uploaded = tasks.some((t) => t.key === "upload" && t.status === "done");
    const lastEvent = ((j.events as { event_date: string | null }[]) ?? []).map((e) => e.event_date).filter(Boolean).sort().pop();
    const mine = tasks.some((t) => t.assignee_id === profile?.id);
    return { j, photo, video, pct, next, people, hasAlbum, uploaded, lastEvent, mine };
  });

  const mineFirst = [...rows].sort((a, b) => Number(b.mine) - Number(a.mine));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Editing queue</h1>
        <span className="text-sm text-muted">{rows.length} jobs in Shot / Post / Album</span>
      </div>
      {rows.length === 0 && <p className="card text-sm text-muted">Nothing in the queue.</p>}
      <div className="space-y-2">
        {mineFirst.map(({ j, photo, video, pct, next, people, hasAlbum, uploaded, lastEvent, mine }) => {
          const late = j.photos_due && j.photos_due < today && pct(photo) < 100;
          return (
            <Link key={j.id} href={`/jobs/${j.id}`} className={`card block hover:border-accent ${late ? "border-red-300" : ""} ${mine ? "bg-soft/30" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">#{j.job_no} {j.title}</span>
                <span className="chip border border-line capitalize">{j.stage}</span>
                <span className="text-muted">shot {lastEvent ? fmtDate(lastEvent) : "—"}</span>
                <span className={late ? "font-medium text-red-700" : "text-muted"}>photos due {fmtDate(j.photos_due)}</span>
                <span className="text-muted">film due {fmtDate(j.film_due)}</span>
                <span className="ml-auto text-xs text-muted">{people.length ? people.join(", ") : "unassigned"}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                <Bar label="Photos" pct={pct(photo)} next={next(photo)?.label} />
                <Bar label="Film" pct={pct(video)} next={next(video)?.label} />
                <div>
                  <div className="flex justify-between text-muted"><span>Album selection</span><span>{j.album_photo_count ? `${j.album_photo_count} photos` : ""}</span></div>
                  <div className="mt-1">
                    {!hasAlbum ? <span className="chip border border-line text-muted">no album</span>
                      : j.selection_received_at ? <span className="chip bg-green-100 text-green-800">received</span>
                      : uploaded ? <span className="chip bg-soft">waiting for client</span>
                      : <span className="chip border border-line text-muted">gallery not up yet</span>}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Bar({ label, pct, next }: { label: string; pct: number; next?: string }) {
  return (
    <div>
      <div className="flex justify-between text-muted"><span>{label}</span><span>{pct}%{next ? ` · ${next}` : pct === 100 ? " · done" : ""}</span></div>
      <div className="mt-1 h-1.5 rounded bg-line"><div className="h-1.5 rounded bg-accent" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
