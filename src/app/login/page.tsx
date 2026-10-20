"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "../actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState(signIn, null);
  const [upState, upAction, upPending] = useActionState(signUp, null);
  const state = mode === "in" ? inState : upState;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Huskky <span className="text-accent">OS</span>
      </h1>
      <p className="mb-6 text-sm text-muted">Team sign-in</p>

      <form action={mode === "in" ? inAction : upAction} className="card space-y-3">
        {mode === "up" && (
          <div>
            <label className="f">Your name</label>
            <input name="full_name" required />
          </div>
        )}
        <div>
          <label className="f">Email</label>
          <input name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="f">Password</label>
          <input name="password" type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </div>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        <button className="btn-primary w-full" disabled={inPending || upPending}>
          {mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="w-full text-center text-xs text-muted hover:text-fg"
        >
          {mode === "in" ? "First time? Create your account" : "Have an account? Sign in"}
        </button>
        {mode === "up" && (
          <p className="text-xs text-muted">
            Your email must already be on the team roster (the owner adds it under Team).
          </p>
        )}
      </form>
    </div>
  );
}
