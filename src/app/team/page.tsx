import { createClient, requireProfile } from "@/lib/supabase/server";
import TeamClient from "./ui";


export default async function TeamPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const [{ data: profiles }, { data: invites }, { data: sla }, { data: biz }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("crew_invites").select("*").is("profile_id", null).order("full_name"),
    supabase.from("settings").select("value").eq("key", "sla").single(),
    supabase.from("settings").select("value").eq("key", "business").single(),
  ]);
  return (
    <TeamClient
      profiles={profiles ?? []}
      invites={invites ?? []}
      sla={(sla?.value as { photos_working_days: number; film_days: number; album_days: number }) ?? { photos_working_days: 7, film_days: 30, album_days: 30 }}
      me={profile}
      biz={(biz?.value as { name?: string; review_url?: string }) ?? {}}
    />
  );
}
