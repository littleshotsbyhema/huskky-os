import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { STAGES, STAGE_LABEL, fmtDate, inr } from "@/lib/constants";


export default async function Dashboard() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const [{ data: jobs }, { data: upcoming }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_no, title, stage, total_amount, photos_due, film_due, album_due, portal_token, selection_received_at, deliverables, album_approved_at, clients(couple_names, phone), events(event_date), payments(amount), post_tasks(key, status, done_at), album_versions(version, status, sent_at), print_orders(expected_on, received_on, vendor), deliveries(gallery_sent_at, album_handover_at, client_confirmed_at)")
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

  // ---- Needs attention ----
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const daysAgo = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : 0);
  const wa = (phone: string | null | undefined, text: string) =>
    `https://wa.me/${(phone ?? "").replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(text)}`;
  type Item = { job: NonNullable<typeof jobs>[number]; kind: string; text: string; wa?: string; tone: "warn" | "bad" };
  const attention: Item[] = [];
  for (const j of jobs ?? []) {
    const c = j.clients as unknown as { couple_names: string; phone: string } | null;
    const portal = `${origin}/portal/${j.portal_token}`;
    const hasAlbum = (((j.deliverables as { albums?: unknown[] })?.albums) ?? []).length > 0;
    const upload = ((j.post_tasks as { key: string; status: string; done_at: string | null }[]) ?? []).find((t) => t.key === "upload" && t.status === "done");
    const vers = ((j.album_versions as { version: number; status: string; sent_at: string | null }[]) ?? []).sort((a, b) => b.version - a.version);
    const latest = vers[0];
    const paid = (j.payments as { amount: number }[]).reduce((a, p) => a + Number(p.amount), 0);
    const balance = Number(j.total_amount) - paid;
    const dl = (Array.isArray(j.deliveries) ? j.deliveries[0] : j.deliveries) as { gallery_sent_at: string | null; album_handover_at: string | null; client_confirmed_at: string | null } | null;
    const pos = (j.print_orders as { expected_on: string | null; received_on: string | null; vendor: string | null }[]) ?? [];

    if (hasAlbum && upload && !j.selection_received_at) {
      const d = daysAgo(upload.done_at);
      if (d >= 7) attention.push({ job: j, kind: "Selection idle", text: `Album picks not received — gallery up ${d} days ago`, tone: d >= 14 ? "bad" : "warn",
        wa: wa(c?.phone, `Hi ${c?.couple_names}! Gentle reminder to pick your album favourites on your Pixieset gallery when you get a moment. Thank you!`) });
    }
    if (latest && (latest.status === "sent") && daysAgo(latest.sent_at) >= 7) {
      const d = daysAgo(latest.sent_at);
      attention.push({ job: j, kind: "Album review idle", text: `Draft v${latest.version} with client for ${d} days`, tone: d >= 14 ? "bad" : "warn",
        wa: wa(c?.phone, `Hi ${c?.couple_names}! Your album draft v${latest.version} is waiting for your review: ${portal}`) });
    }
    if (latest && latest.status === "changes_requested") attention.push({ job: j, kind: "Changes requested", text: `Client asked for changes on v${latest.version} — new draft needed`, tone: "warn" });
    if (j.stage === "post" && j.photos_due && j.photos_due < today) attention.push({ job: j, kind: "Photos overdue", text: `Due ${fmtDate(j.photos_due)}`, tone: "bad" });
    if (j.stage === "album" && j.album_due && j.album_due < today && !j.album_approved_at) attention.push({ job: j, kind: "Album overdue", text: `Approval due ${fmtDate(j.album_due)}`, tone: "bad" });
    for (const po of pos) if (!po.received_on && po.expected_on && po.expected_on < today) attention.push({ job: j, kind: "Print late", text: `${po.vendor ?? "Vendor"} expected ${fmtDate(po.expected_on)}`, tone: "warn" });
    if (balance > 0 && ["album", "delivered"].includes(j.stage)) attention.push({ job: j, kind: "Balance due", text: `${inr(balance)} outstanding`, tone: "warn",
      wa: wa(c?.phone, `Hi ${c?.couple_names}! A reminder that the balance of ${inr(balance)} is due before delivery. Thank you!`) });
    if (j.stage === "delivered" && dl && (dl.gallery_sent_at || dl.album_handover_at) && !dl.client_confirmed_at && daysAgo(dl.album_handover_at ?? dl.gallery_sent_at) >= 7)
      attention.push({ job: j, kind: "Delivery unconfirmed", text: `Delivered ${daysAgo(dl.album_handover_at ?? dl.gallery_sent_at)} days ago — ask client to confirm`, tone: "warn",
        wa: wa(c?.phone, `Hi ${c?.couple_names}! Hope you loved everything. Could you confirm receipt here? ${portal}`) });
  }
  attention.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <div className="flex gap-2">
          <Link href="/jobs/import" className="btn-ghost">Import CSV</Link>
          <Link href="/jobs/new" className="btn-primary">+ New job</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active jobs" value={String(jobs?.length ?? 0)} />
        <Stat label="Events next 7 days" value={String(upcoming?.length ?? 0)} />
        <Stat label="Overdue deliveries" value={String(overdue.length)} tone={overdue.length ? "bad" : undefined} />
        <Stat label="Balance outstanding" value={inr(outstanding)} />
      </div>

      {attention.length > 0 && (
        <section className="card border-amber-200">
          <h2 className="mb-2 text-sm font-semibold">Needs attention <span className="font-normal text-muted">· {attention.length}</span></h2>
          <ul className="divide-y divide-line text-sm">
            {attention.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <span className={`chip ${a.tone === "bad" ? "bg-red-100 text-red-800" : "bg-soft"}`}>{a.kind}</span>
                <Link href={`/jobs/${a.job.id}`} className="font-medium hover:underline">#{a.job.job_no} {a.job.title}</Link>
                <span className="text-muted">{a.text}</span>
                {a.wa && <a href={a.wa} target="_blank" className="ml-auto text-xs text-accent hover:underline">WhatsApp →</a>}
              </li>
            ))}
          </ul>
        </section>
      )}

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
