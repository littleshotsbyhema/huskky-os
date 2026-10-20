"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAGES, Stage, addDays, addWorkingDays, iso } from "@/lib/constants";

type Result = { error?: string; ok?: boolean };

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const n = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === null ? null : Number(v);
};

// ---------- Auth ----------
export async function signIn(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: s(fd, "email") ?? "",
    password: s(fd, "password") ?? "",
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signUp(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: s(fd, "email") ?? "",
    password: s(fd, "password") ?? "",
    options: { data: { full_name: s(fd, "full_name") } },
  });
  if (error) return { error: error.message.replace(/^Database error saving new user/, "Signup blocked") };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- Jobs ----------
export async function createJob(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: client, error: ce } = await supabase
    .from("clients")
    .insert({
      couple_names: s(fd, "couple_names"),
      phone: s(fd, "phone"),
      email: s(fd, "email"),
      city: s(fd, "city"),
    })
    .select("id")
    .single();
  if (ce) return { error: ce.message };

  const { data: job, error: je } = await supabase
    .from("jobs")
    .insert({
      client_id: client.id,
      title: s(fd, "title") ?? s(fd, "couple_names"),
      package_summary: s(fd, "package_summary"),
      total_amount: n(fd, "total_amount") ?? 0,
      album_photo_count: n(fd, "album_photo_count"),
      pixieset_url: s(fd, "pixieset_url"),
      booked_on: s(fd, "booked_on") ?? iso(new Date()),
      notes: s(fd, "notes"),
      created_by: auth.user?.id,
    })
    .select("id")
    .single();
  if (je) return { error: je.message };

  const advance = n(fd, "advance");
  if (advance && advance > 0) {
    await supabase.from("payments").insert({
      job_id: job.id,
      amount: advance,
      method: s(fd, "advance_method") ?? "upi",
      received_on: s(fd, "booked_on") ?? iso(new Date()),
      note: "Advance",
      recorded_by: auth.user?.id,
    });
  }
  revalidatePath("/");
  redirect(`/jobs/${job.id}`);
}

export async function updateJob(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const id = s(fd, "id")!;
  const { error } = await supabase
    .from("jobs")
    .update({
      title: s(fd, "title"),
      package_summary: s(fd, "package_summary"),
      total_amount: n(fd, "total_amount") ?? 0,
      album_photo_count: n(fd, "album_photo_count"),
      pixieset_url: s(fd, "pixieset_url"),
      photos_due: s(fd, "photos_due"),
      film_due: s(fd, "film_due"),
      album_due: s(fd, "album_due"),
      notes: s(fd, "notes"),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${id}`);
  return { ok: true };
}

async function recomputeDueDates(jobId: string) {
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("events")
    .select("event_date")
    .eq("job_id", jobId)
    .not("event_date", "is", null)
    .order("event_date", { ascending: false })
    .limit(1);
  const last = ev?.[0]?.event_date;
  if (!last) return;
  const { data: sla } = await supabase.from("settings").select("value").eq("key", "sla").single();
  const v = (sla?.value ?? {}) as { photos_working_days?: number; film_days?: number; album_days?: number };
  const base = new Date(last + "T00:00:00");
  await supabase
    .from("jobs")
    .update({
      photos_due: iso(addWorkingDays(base, v.photos_working_days ?? 7)),
      film_due: iso(addDays(base, v.film_days ?? 30)),
      album_due: iso(addDays(base, v.album_days ?? 30)),
    })
    .eq("id", jobId);
}

export async function setStage(jobId: string, stage: Stage): Promise<Result> {
  const supabase = await createClient();
  // Gates
  const { data: events } = await supabase
    .from("events")
    .select("id, event_date, venue, assignments(role), ingest_logs(confirmed)")
    .eq("job_id", jobId);
  const evs = events ?? [];
  if (stage === "scheduled") {
    if (evs.length === 0) return { error: "Add at least one event first." };
    if (evs.some((e) => !e.event_date || !e.venue)) return { error: "Every event needs a date and venue." };
  }
  if (stage === "shot") {
    const missing = evs.filter(
      (e) => !(e.assignments as { role: string }[]).some((a) => a.role === "lead_photographer")
    );
    if (missing.length) return { error: "Every event needs a lead photographer assigned." };
  }
  if (stage === "post") {
    const il = evs.filter((e) => {
      const logs = e.ingest_logs as { confirmed: boolean }[] | { confirmed: boolean } | null;
      const l = Array.isArray(logs) ? logs[0] : logs;
      return !l?.confirmed;
    });
    if (il.length) return { error: "Confirm ingest for every event before moving to Post." };
  }
  if (stage === "delivered") {
    const { data: job } = await supabase.from("jobs").select("total_amount, payments(amount)").eq("id", jobId).single();
    const paid = (job?.payments as { amount: number }[] | undefined)?.reduce((a, p) => a + Number(p.amount), 0) ?? 0;
    if (paid < Number(job?.total_amount ?? 0)) return { error: `Balance outstanding: ₹${(Number(job?.total_amount) - paid).toLocaleString("en-IN")}. Record the final payment first.` };
  }
  const { error } = await supabase.from("jobs").update({ stage }).eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function advanceStage(jobId: string, current: Stage) {
  const i = STAGES.indexOf(current);
  if (i < 0 || i === STAGES.length - 1) return { error: "Already closed." };
  return setStage(jobId, STAGES[i + 1]);
}

// ---------- Events ----------
export async function upsertEvent(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const jobId = s(fd, "job_id")!;
  const id = s(fd, "id");
  const row = {
    job_id: jobId,
    type: s(fd, "type"),
    custom_name: s(fd, "custom_name"),
    event_date: s(fd, "event_date"),
    start_time: s(fd, "start_time"),
    end_time: s(fd, "end_time"),
    call_time: s(fd, "call_time"),
    venue: s(fd, "venue"),
    address: s(fd, "address"),
    city: s(fd, "city"),
    overnight: fd.get("overnight") === "on",
    travel_cost: n(fd, "travel_cost") ?? 0,
    notes: s(fd, "notes"),
  };
  const q = id
    ? supabase.from("events").update(row).eq("id", id)
    : supabase.from("events").insert(row);
  const { error } = await q;
  if (error) return { error: error.message };
  await recomputeDueDates(jobId);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function deleteEvent(jobId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", id);
  await recomputeDueDates(jobId);
  revalidatePath(`/jobs/${jobId}`);
}

// ---------- Assignments ----------
export async function addAssignment(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const jobId = s(fd, "job_id")!;
  const person = s(fd, "person") ?? ""; // "p:<uuid>" or "i:<uuid>"
  const [kind, pid] = person.split(":");
  if (!pid) return { error: "Pick a person." };
  const { error } = await supabase.from("assignments").insert({
    event_id: s(fd, "event_id"),
    role: s(fd, "role"),
    profile_id: kind === "p" ? pid : null,
    invite_id: kind === "i" ? pid : null,
    pay_amount: n(fd, "pay_amount"),
  });
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function removeAssignment(jobId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("assignments").delete().eq("id", id);
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleConfirm(jobId: string, id: string, confirmed: boolean) {
  const supabase = await createClient();
  await supabase.from("assignments").update({ confirmed }).eq("id", id);
  revalidatePath(`/jobs/${jobId}`);
}

// ---------- Ingest ----------
export async function saveIngest(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const jobId = s(fd, "job_id")!;
  const confirmed = fd.get("confirmed") === "on";
  const { error } = await supabase.from("ingest_logs").upsert(
    {
      event_id: s(fd, "event_id"),
      card_count: n(fd, "card_count"),
      file_count: n(fd, "file_count"),
      primary_drive: s(fd, "primary_drive"),
      backup_drive: s(fd, "backup_drive"),
      notes: s(fd, "notes"),
      confirmed,
      confirmed_by: confirmed ? auth.user?.id : null,
      confirmed_at: confirmed ? new Date().toISOString() : null,
    },
    { onConflict: "event_id" }
  );
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

// ---------- Payments ----------
export async function addPayment(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const jobId = s(fd, "job_id")!;
  const { error } = await supabase.from("payments").insert({
    job_id: jobId,
    amount: n(fd, "amount"),
    method: s(fd, "method") ?? "upi",
    received_on: s(fd, "received_on") ?? iso(new Date()),
    note: s(fd, "note"),
    recorded_by: auth.user?.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function deletePayment(jobId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("payments").delete().eq("id", id);
  revalidatePath(`/jobs/${jobId}`);
}

// ---------- Team ----------
export async function upsertCrew(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const id = s(fd, "id");
  const table = s(fd, "table") === "profiles" ? "profiles" : "crew_invites";
  const row = {
    full_name: s(fd, "full_name"),
    email: s(fd, "email"),
    phone: s(fd, "phone"),
    role: s(fd, "role"),
    title: s(fd, "title"),
    is_freelance: fd.get("is_freelance") === "on",
    day_rate: n(fd, "day_rate"),
    active: fd.get("active") !== "off",
  };
  const q = id
    ? supabase.from(table).update(row).eq("id", id)
    : supabase.from("crew_invites").insert(row);
  const { error } = await q;
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true };
}

export async function deleteInvite(id: string) {
  const supabase = await createClient();
  await supabase.from("crew_invites").delete().eq("id", id);
  revalidatePath("/team");
}

export async function saveSla(_: Result | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert({
    key: "sla",
    value: {
      photos_working_days: n(fd, "photos_working_days") ?? 7,
      film_days: n(fd, "film_days") ?? 30,
      album_days: n(fd, "album_days") ?? 30,
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true };
}
