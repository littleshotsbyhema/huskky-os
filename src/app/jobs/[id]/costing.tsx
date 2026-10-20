"use client";

import { useActionState } from "react";
import { saveOtherCosts } from "@/app/actions";
import { inr } from "@/lib/constants";

type Costs = { revenue: number; paid: number; crew_cost: number; travel_cost: number; print_cost: number; other_costs: number };

export default function CostingCard({ jobId, c, note, isMgmt }: { jobId: string; c: Costs; note: string | null; isMgmt: boolean }) {
  const [state, action, pending] = useActionState(saveOtherCosts, null);
  const cost = Number(c.crew_cost) + Number(c.travel_cost) + Number(c.print_cost) + Number(c.other_costs);
  const margin = Number(c.revenue) - cost;
  const pct = Number(c.revenue) > 0 ? Math.round((margin / Number(c.revenue)) * 100) : 0;
  const Row = ({ k, v, strong }: { k: string; v: number; strong?: boolean }) => (
    <div className={`flex justify-between py-0.5 ${strong ? "font-semibold" : ""}`}><span className={strong ? "" : "text-muted"}>{k}</span><span>{inr(v)}</span></div>
  );
  return (
    <section className="card text-sm">
      <h2 className="mb-2 font-semibold">Job costing</h2>
      <Row k="Revenue" v={Number(c.revenue)} />
      <Row k="Crew pay" v={Number(c.crew_cost)} />
      <Row k="Travel" v={Number(c.travel_cost)} />
      <Row k="Album print" v={Number(c.print_cost)} />
      <Row k={`Other${note ? ` (${note})` : ""}`} v={Number(c.other_costs)} />
      <div className="my-1 border-t border-line" />
      <Row k="Total cost" v={cost} />
      <div className={`flex justify-between py-0.5 font-semibold ${margin < 0 ? "text-red-700" : "text-green-700"}`}>
        <span>Margin</span><span>{inr(margin)} · {pct}%</span>
      </div>
      <p className="mt-1 text-xs text-muted">Crew pay uses the amount on each assignment, or the person&apos;s day rate if blank.</p>
      {isMgmt && (
        <form action={action} className="mt-3 grid grid-cols-[1fr_2fr_auto] gap-2">
          <input type="hidden" name="job_id" value={jobId} />
          <input name="other_costs" type="number" min={0} defaultValue={Number(c.other_costs) || ""} placeholder="Other ₹" />
          <input name="other_costs_note" defaultValue={note ?? ""} placeholder="e.g. editing freelancer, props" />
          <button className="btn-ghost" disabled={pending}>Save</button>
          {state?.error && <p className="col-span-3 text-xs text-red-700">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
