import { createClient } from "@supabase/supabase-js";
import Portal from "./portal";

export const metadata = { title: "Your album selection — Huskky Photography" };

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.rpc("portal_get", { p_token: token });

  if (error || !data) {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <h1 className="text-xl font-semibold">Link not found</h1>
        <p className="mt-2 text-sm text-muted">This selection link isn&apos;t valid. Please check the message from Huskky Photography or contact us.</p>
      </div>
    );
  }
  return <Portal token={token} initial={data} />;
}
