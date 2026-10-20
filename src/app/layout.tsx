import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { requireProfile } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Huskky OS",
  description: "Huskky Photography — production operations",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  return (
    <html lang="en">
      <body className="min-h-screen">
        {profile && (
          <header className="border-b border-line bg-card">
            <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
              <Link href="/" className="font-semibold tracking-tight">
                Huskky <span className="text-accent">OS</span>
              </Link>
              <nav className="flex gap-4 text-sm text-muted">
                <Link href="/" className="hover:text-fg">Jobs</Link>
                <Link href="/calendar" className="hover:text-fg">Calendar</Link>
                <Link href="/post" className="hover:text-fg">Editing</Link>
                <Link href="/team" className="hover:text-fg">Team</Link>
                {(profile.role === "owner" || profile.role === "manager") && <Link href="/reports" className="hover:text-fg">Reports</Link>}
              </nav>
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-muted">
                  {profile.full_name} · <span className="capitalize">{profile.role}</span>
                </span>
                <form action={signOut}>
                  <button className="btn-ghost py-1">Sign out</button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
