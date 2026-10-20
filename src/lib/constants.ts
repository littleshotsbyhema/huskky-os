export const STAGES = [
  "booked",
  "scheduled",
  "shot",
  "post",
  "album",
  "delivered",
  "closed",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  booked: "Booked",
  scheduled: "Scheduled",
  shot: "Shot",
  post: "Post-production",
  album: "Album",
  delivered: "Delivered",
  closed: "Closed",
};

export const EVENT_TYPES = [
  "engagement",
  "reception",
  "muhurtham",
  "rituals",
  "baby_shower",
  "other",
] as const;
export const EVENT_LABEL: Record<string, string> = {
  engagement: "Engagement",
  reception: "Reception",
  muhurtham: "Muhurtham",
  rituals: "Rituals",
  baby_shower: "Baby Shower",
  other: "Other",
};

export const CREW_ROLES = [
  "lead_photographer",
  "second_shooter",
  "cinematographer",
  "drone",
  "assistant",
  "lights",
  "other",
] as const;
export const CREW_LABEL: Record<string, string> = {
  lead_photographer: "Lead photographer",
  second_shooter: "Second shooter",
  cinematographer: "Cinematographer",
  drone: "Drone",
  assistant: "Assistant",
  lights: "Lights",
  other: "Other",
};

export const USER_ROLES = ["owner", "manager", "photographer", "editor", "designer"] as const;
export const PAYMENT_METHODS = ["upi", "bank", "cash", "card", "other"] as const;

export function inr(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Add N working days (Mon–Sat; Sunday off) */
export function addWorkingDays(start: Date, days: number) {
  const d = new Date(start);
  let n = 0;
  while (n < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) n++;
  }
  return d;
}
export function addDays(start: Date, days: number) {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d;
}
export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
