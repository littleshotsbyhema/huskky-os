"use client";

import { useActionState } from "react";
import { createJob } from "@/app/actions";
import { PAYMENT_METHODS } from "@/lib/constants";
import DeliverablesForm from "@/components/DeliverablesForm";

export default function NewJob() {
  const [state, action, pending] = useActionState(createJob, null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">New job</h1>
      <p className="mb-4 text-sm text-muted">Enter this once the booking is confirmed in Pixieset. Events and crew come next.</p>
      <form action={action} className="card space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="f">Couple / client names *</label>
            <input name="couple_names" required placeholder="Arun & Priya" />
          </div>
          <div>
            <label className="f">Phone *</label>
            <input name="phone" required placeholder="98xxxxxxxx" />
          </div>
          <div>
            <label className="f">Email</label>
            <input name="email" type="email" />
          </div>
          <div>
            <label className="f">City</label>
            <input name="city" placeholder="Coimbatore" />
          </div>
          <div>
            <label className="f">Booked on</label>
            <input name="booked_on" type="date" defaultValue={today} />
          </div>
          <div className="md:col-span-2">
            <label className="f">Job title</label>
            <input name="title" placeholder="Defaults to couple names" />
          </div>
          <div className="md:col-span-2 rounded-lg border border-line p-3">
            <div className="mb-2 text-sm font-semibold">What was sold</div>
            <DeliverablesForm />
            <p className="mt-2 text-xs text-muted">Coverage (traditional / candid / cinematography / drone…) is set per event after the job is created, since it differs by event.</p>
          </div>
          <div>
            <label className="f">Total amount (₹) *</label>
            <input name="total_amount" type="number" min={0} required />
          </div>
          <div>
            <label className="f">Album photo count (for Pixieset selection)</label>
            <input name="album_photo_count" type="number" min={0} placeholder="e.g. 250" />
          </div>
          <div>
            <label className="f">Advance received (₹)</label>
            <input name="advance" type="number" min={0} />
          </div>
          <div>
            <label className="f">Advance method</label>
            <select name="advance_method" defaultValue="upi">
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="f">Pixieset gallery / project link</label>
            <input name="pixieset_url" type="url" placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <label className="f">Notes</label>
            <textarea name="notes" rows={2} />
          </div>
        </div>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <a href="/" className="btn-ghost">Cancel</a>
          <button className="btn-primary" disabled={pending}>Create job</button>
        </div>
      </form>
    </div>
  );
}
