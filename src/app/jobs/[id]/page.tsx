import { notFound } from "next/navigation";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { STAGES, STAGE_LABEL, Stage, fmtDate, inr } from "@/lib/constants";
import JobClient from "./ui";
import PostPanel from "./post";
import AlbumPanel from "./album";
import CostingCard from "./costing";
import { headers } from "next/headers";


export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const [{ data: job }, { data: profiles }, { data: invites }, { data: log }, { data: tasks }, { data: proofs }, { data: versions }, { data: printOrders }, { data: delivery }, { data: biz }, { data: costs }] = await Promise.all([
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
    supabase.from("post_tasks").select("*, profiles(full_name)").eq("job_id", id),
    supabase.from("proofs").select("id, path, filename, picked").eq("job_id", id).order("sort"),
    supabase.from("album_versions").select("*, album_comments(*)").eq("job_id", id).order("version"),
    supabase.from("print_orders").select("*").eq("job_id", id).order("ordered_on"),
    supabase.from("deliveries").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "business").single(),
    supabase.from("job_costs").select("*").eq("job_id", id).single(),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const showPost = STAGES.indexOf(job?.stage as Stage) >= STAGES.indexOf("shot");
  const showAlbum = STAGES.indexOf(job?.stage as Stage) >= STAGES.indexOf("post");
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
        post={showPost ? (
          <PostPanel
            job={job}
            tasks={(tasks ?? []) as never}
            proofs={proofs ?? []}
            team={(profiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
            meId={profile?.id ?? ""}
            isMgmt={isMgmt}
            origin={origin}
          />
        ) : null}
        album={showAlbum ? (
          <AlbumPanel
            job={job}
            versions={(versions ?? []) as never}
            printOrders={printOrders ?? []}
            delivery={delivery}
            isMgmt={isMgmt}
            origin={origin}
            reviewUrl={((biz?.value as { review_url?: string } | null)?.review_url) ?? ""}
          />
        ) : null}
        costing={isMgmt && costs ? <CostingCard jobId={job.id} c={costs} note={job.other_costs_note} isMgmt={isMgmt} /> : null}
      />
    </div>
  );
}
