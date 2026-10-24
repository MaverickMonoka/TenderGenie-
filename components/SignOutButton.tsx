"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      router.replace("/auth");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return <button type="button" disabled={busy} onClick={signOut} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>;
}
