# Huskky OS

Production operations for Huskky Photography — Booked → Scheduled → Shot → Post → Album → Delivered → Closed.

Stack: Next.js 16 · Supabase (project `huskky-os`, ap-south-1) · Vercel.

## Run locally
```
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

## First login
The first account created becomes **Owner**. Everyone after that must have their email on the roster (Team page) before signing up.

## Spec
See `claude/huskky-os-spec.md` in the Huskky project on Claude.
