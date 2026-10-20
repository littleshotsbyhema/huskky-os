"use client";

import { useActionState, useState, useTransition } from "react";
import { previewImport, runImport, type ImportPreview } from "@/app/actions";

const TEMPLATE_COLS = [
  "couple_names", "phone", "email", "city", "title", "package_summary", "total_amount", "advance", "album_photo_count", "pixieset_url", "booked_on", "notes",
  "event1_type", "event1_date", "event1_venue", "event1_city",
  "event2_type", "event2_date", "event2_venue", "event2_city",
  "event3_type", "event3_date", "event3_venue", "event3_city",
];
const SAMPLE = "Arun & Priya,9876543210,arun@example.com,Coimbatore,,Candid + traditional + 1 album,120000,40000,250,,2026-10-15,,Muhurtham,2026-11-20,Le Meridien,Coimbatore,Reception,2026-11-21,Codissia,Coimbatore,,,,";

export default function ImportPage() {
  const [preview, action, pending] = useActionState(previewImport, null);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [running, start] = useTransition();
  const download = () => {
    const blob = new Blob([TEMPLATE_COLS.join(",") + "\n" + SAMPLE + "\n"], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "huskky-jobs-template.csv"; a.click();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold">Import bookings from CSV</h1>
      <p className="text-sm text-muted">
        Export your bookings from Pixieset (or any sheet), arrange the columns to match the template, and upload. Each row becomes a job at <strong>Booked</strong> with its client, advance payment and up to three events. Dates as YYYY-MM-DD.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={download}>Download template CSV</button>
        <form action={action} className="flex items-center gap-2">
          <input type="file" name="file" accept=".csv,text/csv" required className="w-auto" />
          <button className="btn-primary" disabled={pending}>Preview</button>
        </form>
      </div>

      {preview && (
        <div className="card space-y-3 text-sm">
          {preview.errors.length > 0 && (
            <ul className="list-disc pl-5 text-red-700">{preview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
          {preview.rows.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr>{["couple_names", "phone", "total_amount", "advance", "event1_type", "event1_date", "event2_type", "event2_date"].map((h) => <th key={h} className="px-2 py-1 text-left text-muted">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {preview.rows.slice(0, 20).map((r, i) => (
                      <tr key={i}>{["couple_names", "phone", "total_amount", "advance", "event1_type", "event1_date", "event2_type", "event2_date"].map((h) => <td key={h} className="px-2 py-1">{r[h] ?? ""}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 20 && <p className="mt-1 text-muted">…and {preview.rows.length - 20} more</p>}
              </div>
              {!result && (
                <button
                  className="btn-primary"
                  disabled={running || preview.errors.length > 0}
                  onClick={() => start(async () => setResult(await runImport(preview.rows)))}
                >
                  {running ? "Importing…" : `Import ${preview.rows.length} job${preview.rows.length === 1 ? "" : "s"}`}
                </button>
              )}
            </>
          )}
          {result && (
            <div className={result.errors.length ? "text-red-700" : "text-green-700"}>
              <p>Created {result.created} job{result.created === 1 ? "" : "s"}.</p>
              {result.errors.length > 0 && <ul className="list-disc pl-5">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
              <a href="/" className="mt-2 inline-block text-accent underline">Go to jobs →</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
