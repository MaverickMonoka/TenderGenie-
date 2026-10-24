"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  registration_number: string | null;
  tax_number: string | null;
  cidb_grade: string | null;
  csd_number: string | null;
  province: string | null;
  service_categories: string[] | null;
};

export default function CompanyProfilePage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [registration, setRegistration] = useState("");
  const [tax, setTax] = useState("");
  const [cidb, setCidb] = useState("");
  const [csd, setCsd] = useState("");
  const [province, setProvince] = useState("Limpopo");
  const [categories, setCategories] = useState("Construction, Civil Engineering");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/auth?next=/dashboard/company"); return; }
        const { data, error } = await supabase.from("companies")
          .select("id,name,registration_number,tax_number,cidb_grade,csd_number,province,service_categories")
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (error) throw error;
        if (active && data) {
          setCompany(data as Company);
          setName(data.name || "");
          setRegistration(data.registration_number || "");
          setTax(data.tax_number || "");
          setCidb(data.cidb_grade || "");
          setCsd(data.csd_number || "");
          setProvince(data.province || "Limpopo");
          setCategories((data.service_categories || []).join(", "));
        }
      } catch (e) {
        if (active) setNotice(e instanceof Error ? e.message : "Unable to load company profile.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth?next=/dashboard/company"); return; }
      const payload = {
        name: name.trim(),
        registration_number: registration.trim() || null,
        tax_number: tax.trim() || null,
        cidb_grade: cidb.trim() || null,
        csd_number: csd.trim() || null,
        province: province || null,
        service_categories: categories.split(",").map(s => s.trim()).filter(Boolean),
      };
      if (company) {
        const { data, error } = await supabase.from("companies").update(payload).eq("id", company.id)
          .select("id,name,registration_number,tax_number,cidb_grade,csd_number,province,service_categories").single();
        if (error) throw error;
        setCompany(data as Company);
      } else {
        const { data, error } = await supabase.from("companies").insert({ ...payload, created_by: user.id })
          .select("id,name,registration_number,tax_number,cidb_grade,csd_number,province,service_categories").single();
        if (error) throw error;
        setCompany(data as Company);
      }
      setNotice("Company profile saved.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save company profile.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen px-5 py-8 md:px-10">
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard" className="text-sm font-semibold text-sky-300">← Workspace</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Company vault</p>
      <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Company profile</h1>
      <p className="mt-3 max-w-2xl text-slate-400">Maintain the business identity used for tender eligibility checks and proposal returnables. Keep identifiers accurate and upload supporting evidence only to the private document vault.</p>
      {loading ? <p className="mt-8 text-slate-400">Loading company profile…</p> : <form onSubmit={save} className="mt-8 grid gap-5 rounded-2xl border border-slate-700 bg-slate-900/60 p-6 md:grid-cols-2">
        <label className="text-sm font-semibold md:col-span-2">Registered company name *
          <input required maxLength={180} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">CIPC registration number
          <input value={registration} onChange={e=>setRegistration(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">Tax reference
          <input value={tax} onChange={e=>setTax(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">CIDB grade
          <input value={cidb} onChange={e=>setCidb(e.target.value)} placeholder="e.g. 3CE / 4GB" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">CSD supplier number
          <input value={csd} onChange={e=>setCsd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">Primary province
          <select value={province} onChange={e=>setProvince(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal">
            {["Eastern Cape","Free State","Gauteng","KwaZulu-Natal","Limpopo","Mpumalanga","North West","Northern Cape","Western Cape"].map(p=><option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Service categories (comma-separated)
          <input value={categories} onChange={e=>setCategories(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
        </label>
        <div className="md:col-span-2">
          <button disabled={busy} className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? "Saving…" : "Save company profile"}</button>
          {notice && <p role="status" className="mt-3 text-sm text-slate-300">{notice}</p>}
        </div>
      </form>}
    </div>
  </main>;
}
