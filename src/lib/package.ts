// Coverage services (per event) and deliverables (per job) — mirrors the Huskky price list.

export const COVERAGE = [
  ["traditional_photo", "Traditional photo"],
  ["traditional_video", "Traditional video"],
  ["candid_photo", "Candid photo"],
  ["cinematography", "Cinematography"],
  ["drone", "Drone"],
  ["fpv_drone", "FPV drone"],
  ["led_wall", "LED wall"],
  ["live_stream", "Live streaming"],
  ["booth_360", "360 video booth"],
  ["photo_booth", "Instant photo booth"],
] as const;
export type CoverageKey = (typeof COVERAGE)[number][0];
export type Coverage = Partial<Record<CoverageKey, number>>;

/** Which crew role each coverage service needs (for the "crew required" line). */
export const COVERAGE_ROLE: Record<CoverageKey, string> = {
  traditional_photo: "traditional photographer",
  traditional_video: "traditional videographer",
  candid_photo: "candid photographer",
  cinematography: "cinematographer",
  drone: "drone pilot",
  fpv_drone: "FPV drone pilot",
  led_wall: "LED wall operator",
  live_stream: "live-stream operator",
  booth_360: "360 booth operator",
  photo_booth: "photo-booth operator",
};

export function coverageText(c: Coverage | null | undefined) {
  if (!c) return "";
  return COVERAGE.filter(([k]) => (c[k] ?? 0) > 0)
    .map(([k, label]) => `${c[k]! > 1 ? c[k] + "× " : ""}${label}`)
    .join(" · ");
}

export const BOOK_TYPES = ["Standard", "Premium", "Lite book", "Press book", "Magnum book"] as const;
export const COVER_UPGRADES = ["", "Cordova photo inlay", "Cordova metal engrave", "Cordova engrave + inlay", "Alkentarah laser", "Alkentarah hesalite glass", "Alkentarah glazed", "Sakura title print"] as const;
export const BOX_UPGRADES = ["", "Cordova box", "Alkentarah box", "Alkentarah glazed box", "Sakura box", "Parawood box"] as const;
export const FRAME_SIZES = ["12×18", "16×24", "18×24", "20×30", "24×36", "10×15", "8×12", "6×9"] as const;

export type Album = { book: string; sheets: number; copies: number; size?: string; cover?: string; box?: string };
export type Deliverables = {
  package_name?: string;          // Classic / Keepsake / Signature / Legacy / Elite / Royal Affair / Custom
  hd_video_hours?: number;
  cinematic_min?: number;
  teaser?: boolean;
  reels?: number;
  edited_pics?: number;           // colour-corrected
  retouched_pics?: number;
  signature_album?: boolean;
  albums?: Album[];
  frames?: number;
  frame_size?: string;
  raw_backup?: "none" | "gdrive" | "online_1yr";
  notes?: string;
};

export const PACKAGE_NAMES = ["Custom", "Classic", "Keepsake", "Signature", "Legacy", "Elite", "Royal Affair"] as const;

/** One-line summary for lists. */
export function deliverablesText(d: Deliverables | null | undefined) {
  if (!d) return "";
  const parts: string[] = [];
  if (d.package_name && d.package_name !== "Custom") parts.push(d.package_name);
  if (d.hd_video_hours) parts.push(`HD video ${d.hd_video_hours}h`);
  if (d.cinematic_min) parts.push(`Cinematic ${d.cinematic_min}min`);
  if (d.teaser) parts.push("Teaser");
  if (d.reels) parts.push(`${d.reels} reel${d.reels > 1 ? "s" : ""}`);
  if (d.edited_pics) parts.push(`${d.edited_pics} cc pics`);
  if (d.retouched_pics) parts.push(`${d.retouched_pics} retouched`);
  if (d.signature_album) parts.push("Signature album");
  for (const a of d.albums ?? []) parts.push(`${a.copies > 1 ? a.copies + "× " : ""}${a.book} ${a.sheets} sheets${a.cover ? " · " + a.cover : ""}${a.box ? " · " + a.box : ""}`);
  if (d.frames) parts.push(`${d.frames}× ${d.frame_size ?? ""} frame`.trim());
  if (d.raw_backup && d.raw_backup !== "none") parts.push(d.raw_backup === "gdrive" ? "Raw backup (G-drive)" : "Raw backup 1 yr online");
  return parts.join(" · ");
}

/** Parse the deliverables form fields (prefixed d_) from FormData. */
export function deliverablesFromForm(fd: FormData): Deliverables {
  const s = (k: string) => { const v = fd.get("d_" + k); return typeof v === "string" && v.trim() ? v.trim() : undefined; };
  const n = (k: string) => { const v = s(k); return v ? Number(v) : undefined; };
  const albums: Album[] = [];
  for (let i = 0; i < 3; i++) {
    const book = s(`album${i}_book`);
    const sheets = n(`album${i}_sheets`);
    if (book && sheets) albums.push({ book, sheets, copies: n(`album${i}_copies`) ?? 1, size: s(`album${i}_size`), cover: s(`album${i}_cover`), box: s(`album${i}_box`) });
  }
  const d: Deliverables = {
    package_name: s("package_name"),
    hd_video_hours: n("hd_video_hours"),
    cinematic_min: n("cinematic_min"),
    teaser: fd.get("d_teaser") === "on",
    reels: n("reels"),
    edited_pics: n("edited_pics"),
    retouched_pics: n("retouched_pics"),
    signature_album: fd.get("d_signature_album") === "on",
    albums,
    frames: n("frames"),
    frame_size: s("frame_size"),
    raw_backup: (s("raw_backup") as Deliverables["raw_backup"]) ?? "none",
    notes: s("notes"),
  };
  return d;
}

export function coverageFromForm(fd: FormData): Coverage {
  const c: Coverage = {};
  for (const [k] of COVERAGE) {
    const v = fd.get("c_" + k);
    const num = typeof v === "string" && v.trim() ? Number(v) : 0;
    if (num > 0) c[k] = num;
  }
  return c;
}
