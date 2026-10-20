"use client";

import { useState } from "react";
import { BOOK_TYPES, BOX_UPGRADES, COVER_UPGRADES, FRAME_SIZES, PACKAGE_NAMES, type Deliverables } from "@/lib/package";

/** Form fields (all named d_*) for a job's deliverables. Wrap in your own <form>. */
export default function DeliverablesForm({ value }: { value?: Deliverables | null }) {
  const d = value ?? {};
  const [albumCount, setAlbumCount] = useState(Math.max(1, d.albums?.length ?? 1));
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <div>
          <label className="f">Package</label>
          <select name="d_package_name" defaultValue={d.package_name ?? "Custom"}>
            {PACKAGE_NAMES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div><label className="f">HD video (hours)</label><input name="d_hd_video_hours" type="number" step="0.5" min={0} defaultValue={d.hd_video_hours ?? ""} placeholder="0" /></div>
        <div><label className="f">Cinematic (min)</label><input name="d_cinematic_min" type="number" min={0} defaultValue={d.cinematic_min ?? ""} placeholder="0" /></div>
        <div><label className="f">Reels</label><input name="d_reels" type="number" min={0} defaultValue={d.reels ?? ""} placeholder="0" /></div>
        <div><label className="f">Colour-corrected pics</label><input name="d_edited_pics" type="number" min={0} defaultValue={d.edited_pics ?? ""} placeholder="0" /></div>
        <div><label className="f">Retouched pics</label><input name="d_retouched_pics" type="number" min={0} defaultValue={d.retouched_pics ?? ""} placeholder="0" /></div>
        <div><label className="f">Frames</label><input name="d_frames" type="number" min={0} defaultValue={d.frames ?? ""} placeholder="0" /></div>
        <div>
          <label className="f">Frame size</label>
          <select name="d_frame_size" defaultValue={d.frame_size ?? "16×24"}>{FRAME_SIZES.map((f) => <option key={f}>{f}</option>)}</select>
        </div>
        <div>
          <label className="f">Raw backup</label>
          <select name="d_raw_backup" defaultValue={d.raw_backup ?? "none"}>
            <option value="none">None</option><option value="gdrive">G-drive</option><option value="online_1yr">Online, 1 year</option>
          </select>
        </div>
        <div className="flex items-end gap-4 pb-2">
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="d_teaser" defaultChecked={d.teaser} /> Teaser</label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="d_signature_album" defaultChecked={d.signature_album} /> Signature album</label>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Physical albums</span>
          {albumCount < 3 && <button type="button" className="text-xs text-accent hover:underline" onClick={() => setAlbumCount(albumCount + 1)}>+ another album</button>}
        </div>
        {Array.from({ length: albumCount }).map((_, i) => {
          const a = d.albums?.[i];
          return (
            <div key={i} className="mb-1 grid gap-2 md:grid-cols-6">
              <select name={`d_album${i}_book`} defaultValue={a?.book ?? ""}>
                <option value="">— no album —</option>
                {BOOK_TYPES.map((b) => <option key={b}>{b}</option>)}
              </select>
              <input name={`d_album${i}_sheets`} type="number" min={0} defaultValue={a?.sheets ?? ""} placeholder="Sheets" />
              <input name={`d_album${i}_copies`} type="number" min={1} defaultValue={a?.copies ?? 1} placeholder="Copies" />
              <select name={`d_album${i}_size`} defaultValue={a?.size ?? "12×18"}><option>12×12</option><option>12×15</option><option>12×18</option><option>15×15</option></select>
              <select name={`d_album${i}_cover`} defaultValue={a?.cover ?? ""}>{COVER_UPGRADES.map((c) => <option key={c} value={c}>{c || "Standard cover"}</option>)}</select>
              <select name={`d_album${i}_box`} defaultValue={a?.box ?? ""}>{BOX_UPGRADES.map((c) => <option key={c} value={c}>{c || "Standard box"}</option>)}</select>
            </div>
          );
        })}
      </div>

      <div><label className="f">Package notes</label><input name="d_notes" defaultValue={d.notes ?? ""} placeholder="Anything extra promised" /></div>
    </div>
  );
}
