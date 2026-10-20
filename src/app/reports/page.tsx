import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { STAGE_LABEL, Stage, fmtDate, inr } from "@/lib/constants";

export default async function Reports() {
  const { profile } = await requireProfile();
  if (profile?.role !== "owner" && profile?.role !== "manager") redirect("/");
  const supabase = await createClient();
  const [{ data: costs }, { data: payments }] = await Promise.all([
    supabase.from("job_costs").select("*").order("first_event", { ascending: false, nullsFirst: false }),
    supabase.from("payments").select("amount, received_on"),
  ]);

  const rows = (costs ?? []).map((c) => {
    const cost = Number(c.crew_cost) + Number(c.travel_cost) + Number(c.print_cost) + Number(c.other_costs);
    const margin = Number(c.revenue) - cost;
    return { ...c, cost, margin, pct: Number(c.revenue) > 0 ? Math.round((margin / Number(c.revenue)) * 100) : 0, month: (c.first_event ?? c.booked_on ?? "").slice(0, 7) };
  });

  // Month summary (by first event month)
  const months: Record<string, { jobs: number; revenue: number; cost: number; collected: number }> = {};
  for (const r of rows) { const m = months[r.month] ??= { jobs: 0, revenue: 0, cost: 0, collected: 0 }; m.jobs++; m.revenue += Number(r.revenue); m.cost += r.cost; }
  for (const p of payments ?? []) { const k = p.received_on.slice(0, 7); (months[k] ??= { jobs: 0, revenue: 0, cost: 0, collected: 0 }).collected += Number(p.amount); }
  const monthKeys = Object.keys(months).filter(Boolean).sort().reverse();
  const totals = rows.reduce((a, r) => ({ revenue: a.revenue + Number(r.revenue), cost: a.cost + r.cost, paid: a.paid + Number(r.paid) }), { revenue: 0, cost: 0, paid: 0 });
  const mLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reports</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Booked revenue" value={inr(totals.revenue)} />
        <Stat label="Collected" value={inr(totals.paid)} />
        <Stat label="Outstanding" value={inr(totals.revenue - totals.paid)} />
        <Stat label="Margin (all jobs)" value={`${inr(totals.revenue - totals.cost)} · ${totals.revenue ? Math.round(((totals.revenue - totals.cost) / totals.revenue) * 100) : 0}%`} />
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">By month (event month; collected = payments received that month)</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Month</th><th>Jobs</th><th className="text-right">Revenue</th><th className="text-right">Cost</th><th className="text-right">Margin</th><th className="text-right">Collected</th></tr></thead>
          <tbody className="divide-y divide-line">
            {monthKeys.map((m) => { const x = months[m]; const mg = x.revenue - x.cost; return (
              <tr key={m}><td className="py-1">{mLabel(m)}</td><td>{x.jobs}</td><td className="text-right">{inr(x.revenue)}</td><td className="text-right">{inr(x.cost)}</td><td className={`text-right ${mg < 0 ? "text-red-700" : ""}`}>{inr(mg)}{x.revenue ? ` (${Math.round((mg / x.revenue) * 100)}%)` : ""}</td><td className="text-right">{inr(x.collected)}</td></tr>
            ); })}
            {monthKeys.length === 0 && <tr><td colSpan={6} className="py-2 text-muted">No jobs yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">Per job</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Job</th><th>Stage</th><th>Event</th><th className="text-right">Revenue</th><th className="text-right">Crew</th><th className="text-right">Travel</th><th className="text-right">Print</th><th className="text-right">Other</th><th className="text-right">Margin</th><th className="text-right">Balance</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.job_id}>
                <td className="py-1"><Link href={`/jobs/${r.job_id}`} className="hover:underline">#{r.job_no} {r.title}</Link></td>
                <td className="text-muted">{STAGE_LABEL[r.stage as Stage]}</td>
                <td className="text-muted">{fmtDate(r.first_event)}</td>
                <td className="text-right">{inr(r.revenue)}</td>
                <td className="text-right">{inr(r.crew_cost)}</td>
                <td className="text-right">{inr(r.travel_cost)}</td>
                <td className="text-right">{inr(r.print_cost)}</td>
                <td className="text-right">{inr(r.other_costs)}</td>
                <td className={`text-right font-medium ${r.margin < 0 ? "text-red-700" : "text-green-700"}`}>{inr(r.margin)} ({r.pct}%)</td>
                <td className={`text-right ${Number(r.revenue) - Number(r.paid) > 0 ? "text-red-700" : "text-muted"}`}>{inr(Number(r.revenue) - Number(r.paid))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="card py-3"><div className="text-xs text-muted">{label}</div><div className="text-lg font-semibold">{value}</div></div>;
}
