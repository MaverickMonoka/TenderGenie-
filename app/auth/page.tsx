"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Account created. Check your email to confirm your address, then sign in.");
          return;
        }
        if (companyName.trim()) {
          const { error: companyError } = await supabase.from("companies").insert({
            name: companyName.trim(),
            created_by: data.user.id,
          });
          if (companyError) throw companyError;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm font-semibold text-sky-300">← TenderGenie AI</Link>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 text-slate-900 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Secure workspace</p>
          <h1 className="mt-3 text-3xl font-extrabold">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-slate-600">Your company documents and tender records stay behind authenticated, company-scoped access controls.</p>
          <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
            <button type="button" onClick={() => {setMode("signin");setMessage("");}} className={`rounded-md px-3 py-2 font-semibold ${mode === "signin" ? "bg-white shadow" : "text-slate-500"}`}>Sign in</button>
            <button type="button" onClick={() => {setMode("signup");setMessage("");}} className={`rounded-md px-3 py-2 font-semibold ${mode === "signup" ? "bg-white shadow" : "text-slate-500"}`}>Create account</button>
          </div>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "signup" && <label className="block text-sm font-semibold">Company name (optional)
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} maxLength={180} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-blue-600" placeholder="Registered business name" />
            </label>}
            <label className="block text-sm font-semibold">Email address
              <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-blue-600" placeholder="you@company.co.za" />
            </label>
            <label className="block text-sm font-semibold">Password
              <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-blue-600" placeholder="At least 8 characters" />
            </label>
            <button disabled={busy} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? "Please wait…" : mode === "signin" ? "Sign in securely" : "Create account"}</button>
          </form>
          {message && <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
          <p className="mt-5 text-xs leading-5 text-slate-500">Account creation depends on the configured Supabase Auth project and email confirmation settings. Never upload passwords or API keys as tender documents.</p>
        </section>
      </div>
    </main>
  );
}
