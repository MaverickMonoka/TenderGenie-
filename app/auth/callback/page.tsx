"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your email address…");

  useEffect(() => {
    let active = true;
    async function complete() {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (!code) throw new Error("Confirmation code is missing or expired. Return to sign in and request a new confirmation email.");
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (!active) return;
        setMessage("Email confirmed. Opening your workspace…");
        router.replace("/dashboard");
        router.refresh();
      } catch (e) {
        if (active) setMessage(e instanceof Error ? e.message : "Unable to complete email confirmation.");
      }
    }
    complete();
    return () => { active = false; };
  }, [router]);

  return <main className="min-h-screen px-5 py-16"><div className="mx-auto max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-7">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">TenderGenie secure access</p>
    <h1 className="mt-3 text-2xl font-extrabold">Email confirmation</h1>
    <p role="status" className="mt-4 text-slate-300">{message}</p>
    <Link href="/auth" className="mt-6 inline-block font-semibold text-sky-300 underline">Return to sign in</Link>
  </div></main>;
}
