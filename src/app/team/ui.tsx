"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteInvite, saveBusiness, saveSla, upsertCrew } from "@/app/actions";
import { USER_ROLES, inr } from "@/lib/constants";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Props = {
  profiles: any[];
  invites: any[];
  sla: { photos_working_days: number; film_days: number; album_days: number };
  me: any;
  biz: { name?: string; review_url?: string };
};

export default function TeamClient({ profiles, invites, sla, me, biz }: Props) {
  const isOwner = me?.role === "owner";
  const isMgmt = isOwner || me?.role === "manager";
  const [editing, setEditing] = useState<{ table: "profiles" | "crew_invites"; row: any } | null>(null);
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team</h1>
        {isMgmt && <button className="btn-primary" onClick={() => { setAdding(true); setEditing(null); }}>+ Add person</button>}
      </div>

      {(adding || editing) && (
        <CrewForm
          table={editing?.table ?? "crew_invites"}
          row={editing?.row}
          canChangeRole={isOwner}
          onDone={() => { setAdding(false); setEditing(null); }}
        />
      )}

      <section className="card">
        <h2 className="mb-2 text-sm font-semibold">Signed in</h2>
        <Table rows={profiles} canEdit={isOwner} onEdit={(r) => { setEditing({ table: "profiles", row: r }); setAdding(false); }} />
      </section>

      <section className="card">
        <h2 className="mb-1 text-sm font-semibold">Roster (not signed up yet)</h2>
        <p className="mb-2 text-xs text-muted">Add the email they&apos;ll sign up with — the account is created with this role automatically. Freelancers don&apos;t need to sign up; they can still be assigned to events.</p>
        <Table
          rows={invites}
          canEdit={isMgmt}
          onEdit={(r) => { setEditing({ table: "crew_invites", row: r }); setAdding(false); }}
          onDelete={isMgmt ? (r) => { if (confirm(`Remove ${r.full_name} from the roster?`)) start(() => deleteInvite(r.id)); } : undefined}
        />
      </section>

      {isOwner && <SlaForm sla={sla} />}
      {isOwner && <BusinessForm biz={biz} />}
    </div>
  );
}

function Table({ rows, canEdit, onEdit, onDelete }: { rows: any[]; canEdit: boolean; onEdit: (r: any) => void; onDelete?: (r: any) => void }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Nobody here yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted">
        <tr><th className="py-1">Name</th><th>Title</th><th>Role</th><th>Email</th><th>Type</th><th className="text-right">Day rate</th><th></th></tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.id} className={r.active === false ? "opacity-50" : ""}>
            <td className="py-1.5 font-medium">{r.full_name}</td>
            <td className="text-muted">{r.title ?? "—"}</td>
            <td className="capitalize">{r.role}</td>
            <td className="text-muted">{r.email ?? "—"}</td>
            <td className="text-muted">{r.is_freelance ? "Freelance" : "In-house"}</td>
            <td className="text-right">{r.day_rate != null ? inr(r.day_rate) : "—"}</td>
            <td className="text-right text-xs">
              {canEdit && <button className="text-muted hover:text-fg" onClick={() => onEdit(r)}>Edit</button>}
              {onDelete && <button className="ml-2 text-red-700" onClick={() => onDelete(r)}>Remove</button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CrewForm({ table, row, canChangeRole, onDone }: { table: "profiles" | "crew_invites"; row?: any; canChangeRole: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (p: any, fd: FormData) => {
    const r = await upsertCrew(p, fd);
    if (r.ok) onDone();
    return r;
  }, null);
  return (
    <form action={action} className="card space-y-3 border-dashed">
      <input type="hidden" name="table" value={table} />
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="text-sm font-medium">{row ? `Edit ${row.full_name}` : "Add to roster"}</div>
      <div className="grid gap-2 md:grid-cols-3">
        <div><label className="f">Full name</label><input name="full_name" defaultValue={row?.full_name ?? ""} required /></div>
        <div><label className="f">Title</label><input name="title" defaultValue={row?.title ?? ""} placeholder="Head Photographer" /></div>
        <div>
          <label className="f">Role (permissions)</label>
          <select name="role" defaultValue={row?.role ?? "photographer"} disabled={!canChangeRole}>
            {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {!canChangeRole && <input type="hidden" name="role" value={row?.role ?? "photographer"} />}
        </div>
        <div><label className="f">Email (sign-up email)</label><input name="email" type="email" defaultValue={row?.email ?? ""} /></div>
        <div><label className="f">Phone</label><input name="phone" defaultValue={row?.phone ?? ""} /></div>
        <div><label className="f">Day rate ₹</label><input name="day_rate" type="number" min={0} defaultValue={row?.day_rate ?? ""} /></div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_freelance" id="fl" defaultChecked={row?.is_freelance} />
          <label htmlFor="fl" className="text-sm">Freelancer</label>
        </div>
        {row && (
          <div className="flex items-center gap-2">
            <input type="checkbox" name="active" id="ac" value="on" defaultChecked={row.active !== false} />
            <input type="hidden" name="active" value="off" />
            <label htmlFor="ac" className="text-sm">Active</label>
          </div>
        )}
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={pending}>Save</button>
      </div>
    </form>
  );
}

function SlaForm({ sla }: { sla: Props["sla"] }) {
  const [state, action, pending] = useActionState(saveSla, null);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="text-sm font-semibold">Delivery SLAs</h2>
      <p className="text-xs text-muted">Counted from the last event date of a job. Photos use working days (Sundays excluded).</p>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="f">Photos (working days)</label><input name="photos_working_days" type="number" min={1} defaultValue={sla.photos_working_days} /></div>
        <div><label className="f">Film (days)</label><input name="film_days" type="number" min={1} defaultValue={sla.film_days} /></div>
        <div><label className="f">Album approval (days)</label><input name="album_days" type="number" min={1} defaultValue={sla.album_days} /></div>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700">Saved.</p>}
      <div className="flex justify-end"><button className="btn-ghost" disabled={pending}>Save SLAs</button></div>
    </form>
  );
}

function BusinessForm({ biz }: { biz: Props["biz"] }) {
  const [state, action, pending] = useActionState(saveBusiness, null);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="text-sm font-semibold">Business</h2>
      <div className="grid gap-2 md:grid-cols-2">
        <div><label className="f">Name</label><input name="name" defaultValue={biz.name ?? "Huskky Photography"} /></div>
        <div><label className="f">Google review link</label><input name="review_url" type="url" defaultValue={biz.review_url ?? ""} placeholder="https://g.page/r/.../review" /></div>
      </div>
      <p className="text-xs text-muted">The review link is used for the “Ask for Google review” WhatsApp button on delivered jobs.</p>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700">Saved.</p>}
      <div className="flex justify-end"><button className="btn-ghost" disabled={pending}>Save</button></div>
    </form>
  );
}
