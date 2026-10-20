import { notFound } from "next/navigation";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { STAGES, STAGE_LABEL, Stage, fmtDate, inr } from "@/lib/constants";
import JobClient from "./ui";


export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const [{ data: job }, { data: profiles }, { data: invites }, { data: log }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        `*, clients(*), payments(*),
         events(*, ingest_logs(*), assignments(*, profiles(id, full_name), crew_invites(id, full_name)))`
      )
      .eq("id", id)
      .single(),
    supabase.from("profiles").select("id, full_name, role, day_rate, is_freelance").eq("active", true).order("full_name"),
    supabase.from("crew_invites").select("id, full_name, role, day_rate, is_freelance").eq("active", true).is("profile_id", null).order("full_name"),
    supabase.from("job_stage_log").select("to_stage, changed_at, profiles(full_name)").eq("job_id", id).order("changed_at", { ascending: false }),
  ]);
  if (!job) notFound();

  const paid = (job.payments as { amount: number }[]).reduce((a, p) => a + Number(p.amount), 0);
  const balance = Number(job.total_amount) - paid;
  const isMgmt = profile?.role === "owner" || profile?.role === "manager";
  const people = [
    ...(profiles ?? []).map((p) => ({ key: `p:${p.id}`, name: p.full_name, role: p.role, rate: p.day_rate, freelance: p.is_freelance })),
    ...(invites ?? []).map((p) => ({ key: `i:${p.id}`, name: p.full_name, role: p.role, rate: p.day_rate, freelance: p.is_freelance })),
  ];

  const stageIdx = STAGES.indexOf(job.stage as Stage);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted">Job #{job.job_no} · booked {fmtDate(job.booked_on)}</div>
          <h1 className="text-xl font-semibold">{job.title}</h1>
          <div className="text-sm text-muted">
            {job.clients?.couple_names} · {job.clients?.phone}{job.clients?.city ? ` · ${job.clients.city}` : ""}
          </div>
        </div>
        <div className="text-right text-sm">
          <div>Total {inr(job.total_amount)} · Paid {inr(paid)}</div>
          <div className={balance > 0 ? "font-medium text-red-700" : "font-medium text-green-700"}>
            {balance > 0 ? `Balance ${inr(balance)}` : "Fully paid"}
          </div>
        </div>
      </div>

      {/* Stage strip */}
      <ol className="flex flex-wrap gap-1 text-xs">
        {STAGES.map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${i < stageIdx ? "bg-soft text-fg" : i === stageIdx ? "bg-accent text-accent-fg" : "border border-line text-muted"}`}
          >
            {STAGE_LABEL[s]}
          </li>
        ))}
      </ol>

      <JobClient
        job={job}
        people={people}
        isMgmt={isMgmt}
        log={(log ?? []).map((l) => ({ to_stage: l.to_stage, changed_at: l.changed_at, by: (l.profiles as unknown as { full_name: string } | null)?.full_name ?? "—" }))}
      />
    </div>
  );
}
