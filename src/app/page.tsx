import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_LABEL, fmtDate, inr } from "@/lib/constants";


export default async function Dashboard() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const [{ data: jobs }, { data: upcoming }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_no, title, stage, total_amount, photos_due, film_due, album_due, clients(couple_names), events(event_date), payments(amount)")
      .neq("stage", "closed")
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, type, custom_name, event_date, venue, city, call_time, jobs(id, title), assignments(id, role, profiles(full_name), crew_invites(full_name))")
      .gte("event_date", today)
      .lte("event_date", week)
      .order("event_date"),
  ]);

  const byStage = Object.fromEntries(STAGES.map((s) => [s, [] as NonNullable<typeof jobs>])) as Record<string, NonNullable<typeof jobs>>;
  for (const j of jobs ?? []) byStage[j.stage].push(j);

  const overdue = (jobs ?? []).filter((j) => {
    const due = j.stage === "post" ? j.photos_due : j.stage === "album" ? j.album_due : null;
    return due && due < today;
  });
  const outstanding = (jobs ?? []).reduce((acc, j) => {
    const paid = (j.payments as { amount: number }[]).reduce((a, p) => a + Number(p.amount), 0);
    return acc + Math.max(0, Number(j.total_amount) - paid);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <Link href="/jobs/new" className="btn-primary">+ New job</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active jobs" value={String(jobs?.length ?? 0)} />
        <Stat label="Events next 7 days" value={String(upcoming?.length ?? 0)} />
        <Stat label="Overdue deliveries" value={String(overdue.length)} tone={overdue.length ? "bad" : undefined} />
        <Stat label="Balance outstanding" value={inr(outstanding)} />
      </div>

      {upcoming && upcoming.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">This week</h2>
          <ul className="divide-y divide-line text-sm">
            {upcoming.map((e) => {
              const job = e.jobs as unknown as { id: string; title: string } | null;
              const crew = (e.assignments as unknown as { id: string; role: string; profiles: { full_name: string } | null; crew_invites: { full_name: string } | null }[])
                .map((a) => a.profiles?.full_name ?? a.crew_invites?.full_name)
                .filter(Boolean);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                  <span className="w-24 font-medium">{fmtDate(e.event_date)}</span>
                  <Link href={`/jobs/${job?.id}`} className="font-medium hover:underline">{job?.title}</Link>
                  <span className="text-muted">{e.custom_name ?? e.type} · {e.venue}{e.city ? `, ${e.city}` : ""}</span>
                  <span className="ml-auto text-xs text-muted">{crew.length ? crew.join(", ") : <span className="text-red-700">No crew</span>}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STAGES.filter((s) => s !== "closed").map((stage) => (
          <div key={stage} className="rounded-xl border border-line bg-card/60 p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{STAGE_LABEL[stage]}</span>
              <span className="text-xs text-muted">{byStage[stage].length}</span>
            </div>
            <div className="space-y-2">
              {byStage[stage].map((j) => {
                const dates = (j.events as { event_date: string | null }[]).map((e) => e.event_date).filter(Boolean).sort();
                const due = stage === "post" ? j.photos_due : stage === "album" ? j.album_due : null;
                const late = due && due < today;
                return (
                  <Link key={j.id} href={`/jobs/${j.id}`} className={`block rounded-lg border bg-card p-2 text-sm hover:border-accent ${late ? "border-red-300" : "border-line"}`}>
                    <div className="font-medium leading-tight">{j.title}</div>
                    <div className="text-xs text-muted">#{j.job_no} · {dates[0] ? fmtDate(dates[0]) : "no date"}</div>
                    {due && <div className={`text-xs ${late ? "text-red-700" : "text-muted"}`}>Due {fmtDate(due)}</div>}
                  </Link>
                );
              })}
              {byStage[stage].length === 0 && <p className="px-1 py-3 text-center text-xs text-muted">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="card py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-xl font-semibold ${tone === "bad" ? "text-red-700" : ""}`}>{value}</div>
    </div>
  );
}
