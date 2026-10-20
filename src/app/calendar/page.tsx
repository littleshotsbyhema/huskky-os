import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EVENT_LABEL } from "@/lib/constants";


export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const now = new Date();
  const [y, mo] = m ? m.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(y, mo - 1, 1);
  const last = new Date(y, mo, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const prev = new Date(y, mo - 2, 1);
  const next = new Date(y, mo, 1);

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, type, custom_name, event_date, city, jobs(id, title, stage), assignments(role, profiles(full_name), crew_invites(full_name))")
    .gte("event_date", iso(first))
    .lte("event_date", iso(last))
    .order("event_date");

  const byDay: Record<string, NonNullable<typeof events>> = {};
  for (const e of events ?? []) (byDay[e.event_date!] ??= []).push(e);

  // crew load
  const load: Record<string, number> = {};
  for (const e of events ?? [])
    for (const a of e.assignments as unknown as { profiles: { full_name: string } | null; crew_invites: { full_name: string } | null }[]) {
      const nm = a.profiles?.full_name ?? a.crew_invites?.full_name;
      if (nm) load[nm] = (load[nm] ?? 0) + 1;
    }

  const cells: (Date | null)[] = [];
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells.push(null); // Monday first
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, mo - 1, d));
  while (cells.length % 7) cells.push(null);

  const label = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const today = iso(now);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{label}</h1>
        <Link href={`/calendar?m=${iso(prev).slice(0, 7)}`} className="btn-ghost py-1">‹</Link>
        <Link href={`/calendar`} className="btn-ghost py-1">Today</Link>
        <Link href={`/calendar?m=${iso(next).slice(0, 7)}`} className="btn-ghost py-1">›</Link>
        <span className="ml-auto text-sm text-muted">{events?.length ?? 0} events</span>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-card px-2 py-1 font-medium text-muted">{d}</div>
        ))}
        {cells.map((d, i) => {
          const key = d ? iso(d) : "";
          const evs = d ? byDay[key] ?? [] : [];
          return (
            <div key={i} className={`min-h-24 bg-card p-1.5 ${key === today ? "bg-soft/40" : ""} ${!d ? "opacity-40" : ""}`}>
              {d && <div className={`mb-1 ${d.getDay() === 0 ? "text-red-700" : "text-muted"}`}>{d.getDate()}</div>}
              {evs.map((e) => {
                const job = e.jobs as unknown as { id: string; title: string } | null;
                const crew = (e.assignments as unknown[]).length;
                return (
                  <Link key={e.id} href={`/jobs/${job?.id}`} className={`mb-1 block truncate rounded px-1 py-0.5 ${crew ? "bg-soft" : "bg-red-100 text-red-800"}`} title={`${job?.title} — ${e.custom_name ?? EVENT_LABEL[e.type]}${crew ? "" : " (no crew)"}`}>
                    {job?.title} · {e.custom_name ?? EVENT_LABEL[e.type]}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Crew load this month</h2>
        {Object.keys(load).length === 0 ? (
          <p className="text-muted">No assignments this month.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {Object.entries(load).sort((a, b) => b[1] - a[1]).map(([nm, c]) => (
              <li key={nm} className="chip border border-line">{nm}: {c} event{c > 1 ? "s" : ""}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
