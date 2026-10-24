"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company = { id: string; name: string; province: string | null; service_categories: string[] | null; cidb_categories: string[] | null; cidb_grade: string | null; csd_number: string | null; registration_number: string | null };
type Tender = {
  id: string; company_id: string; source_name: string; source_url: string | null; reference_number: string | null;
  title: string; buyer_name: string | null; description: string | null; province: string | null; categories: string[];
  closing_at: string | null; clarification_deadline: string | null; status: string; created_at: string;
};
const states = ["discovered","screening","qualified","no_bid","bid_approved","estimating","compliance","proposal","ready_for_approval","submitted","awarded","unsuccessful","cancelled","closed"];

function dateLabel(value: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function TenderRadarPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [title, setTitle] = useState("");
  const [buyer, setBuyer] = useState("");
  const [source, setSource] = useState("Manual entry");
  const [sourceUrl, setSourceUrl] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [province, setProvince] = useState("Limpopo");
  const [categories, setCategories] = useState("Construction, Civil Engineering");
  const [closing, setClosing] = useState("");
  const [clarification, setClarification] = useState("");
  const [status, setStatus] = useState("discovered");
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadTenders(id: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("tenders").select("*").eq("company_id", id).order("closing_at", { ascending: true, nullsFirst: false }).limit(250);
    if (error) throw error;
    setTenders((data || []) as Tender[]);
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/auth"); return; }
        const { data, error } = await supabase.from("companies").select("id,name,province,service_categories,cidb_categories,cidb_grade,csd_number,registration_number").order("created_at", { ascending: true });
        if (error) throw error;
        if (!active) return;
        const list = (data || []) as Company[];
        setCompanies(list);
        if (list[0]) {
          setCompanyId(list[0].id);
          await loadTenders(list[0].id);
        }
      } catch (e) {
        if (active) setNotice(e instanceof Error ? e.message : "Unable to load tender radar.");
      } finally { if (active) setLoading(false); }
    }
    init();
    return () => { active = false; };
  }, [router]);

  async function changeCompany(id: string) {
    setCompanyId(id);
    try { await loadTenders(id); } catch (e) { setNotice(e instanceof Error ? e.message : "Unable to load tenders."); }
  }

  async function addTender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true); setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again to continue.");
      const payload = {
        company_id: companyId, created_by: user.id, title: title.trim(), buyer_name: buyer.trim() || null,
        source_name: source.trim() || "Manual entry", source_url: sourceUrl.trim() || null,
        reference_number: reference.trim() || null, description: description.trim() || null,
        province: province || null, categories: categories.split(",").map(x=>x.trim()).filter(Boolean),
        closing_at: closing ? new Date(closing).toISOString() : null,
        clarification_deadline: clarification ? new Date(clarification).toISOString() : null, status,
      };
      const { error } = await supabase.from("tenders").insert(payload);
      if (error) throw error;
      setTitle(""); setBuyer(""); setSourceUrl(""); setReference(""); setDescription(""); setClosing(""); setClarification("");
      await loadTenders(companyId);
      setNotice("Tender record saved. This is a manual record; automated tender-source ingestion is not configured yet.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Unable to save tender."); }
    finally { setBusy(false); }
  }

  async function changeStatus(tender: Tender, next: string) {
    setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("tenders").update({ status: next, updated_at: new Date().toISOString() }).eq("id", tender.id).eq("company_id", companyId);
      if (error) throw error;
      // Database trigger appends the lifecycle event in the same transaction.
      await loadTenders(companyId);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Unable to change tender status."); }
  }

  const visible = useMemo(() => tenders.filter(t => filter === "all" || (filter === "active" ? !["awarded","unsuccessful","cancelled","closed","no_bid"].includes(t.status) : t.status === filter)), [tenders, filter]);
  const closingSoon = tenders.filter(t => t.closing_at && new Date(t.closing_at).getTime() >= Date.now() && new Date(t.closing_at).getTime() <= Date.now() + 7*86400000).length;

  return <main className="min-h-screen px-5 py-8 md:px-10">
    <div className="mx-auto max-w-7xl">
      <Link href="/dashboard" className="text-sm font-semibold text-sky-300">← Workspace</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Tender Radar</p>
      <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Tender discovery & deadlines</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Capture and track tender opportunities, clarification deadlines, closing dates and qualification status. Tender records entered here are manual until approved public-source connectors are configured.</p>
      {loading ? <p className="mt-8 text-slate-400">Loading opportunities…</p> : companies.length === 0 ? <section className="mt-8 rounded-xl border border-slate-700 p-6"><p>Create a company profile before tracking tenders.</p><Link className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-bold" href="/dashboard/company">Company profile</Link></section> : <>
        <div className="mt-7 flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <label className="text-sm font-semibold">Company <select value={companyId} onChange={e=>changeCompany(e.target.value)} className="ml-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2">{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <span className="rounded-full bg-blue-950 px-3 py-1 text-sm text-blue-200">{tenders.length} tracked</span>
          <span className="rounded-full bg-amber-950 px-3 py-1 text-sm text-amber-200">{closingSoon} closing in 7 days</span>
        </div>
        <form onSubmit={addTender} className="mt-6 grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-6 md:grid-cols-3">
          <h2 className="text-xl font-bold md:col-span-3">Add opportunity</h2>
          <label className="text-sm font-semibold md:col-span-2">Tender title *
            <input required maxLength={300} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" placeholder="Road rehabilitation, building works…" />
          </label>
          <label className="text-sm font-semibold">Buyer / issuing organisation
            <input value={buyer} onChange={e=>setBuyer(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">Source name
            <input required value={source} onChange={e=>setSource(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">Source URL
            <input type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">Tender reference
            <input value={reference} onChange={e=>setReference(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">Closing date & time
            <input type="datetime-local" value={closing} onChange={e=>setClosing(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">Clarification deadline
            <input type="datetime-local" value={clarification} onChange={e=>setClarification(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">Initial status
            <select value={status} onChange={e=>setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal">{states.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select>
          </label>
          <label className="text-sm font-semibold">Province
            <select value={province} onChange={e=>setProvince(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal">{["Eastern Cape","Free State","Gauteng","KwaZulu-Natal","Limpopo","Mpumalanga","North West","Northern Cape","Western Cape","National"].map(p=><option key={p}>{p}</option>)}</select>
          </label>
          <label className="text-sm font-semibold md:col-span-2">Categories (comma-separated)
            <input value={categories} onChange={e=>setCategories(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold md:col-span-3">Scope / notes
            <textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" />
          </label>
          <div className="md:col-span-3"><button disabled={busy} className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save tender record"}</button></div>
        </form>
        {notice && <p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">{notice}</p>}
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-4"><h2 className="font-bold">Opportunity register</h2><select aria-label="Filter tenders" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"><option value="active">Active opportunities</option><option value="all">All records</option>{states.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></div>
          {visible.length === 0 ? <p className="p-6 text-slate-400">No opportunities match this filter.</p> : <div className="divide-y divide-slate-800">{visible.map(t=>{
            const closingMs = t.closing_at ? new Date(t.closing_at).getTime() : null;
            const overdue = closingMs !== null && closingMs < Date.now() && !["submitted","awarded","unsuccessful","cancelled","closed"].includes(t.status);
            const soon = closingMs !== null && closingMs >= Date.now() && closingMs <= Date.now()+7*86400000;
            return <article key={t.id} className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{t.title}</h3>{overdue && <span className="rounded-full bg-red-950 px-2 py-1 text-xs font-bold text-red-200">Overdue</span>}{soon && <span className="rounded-full bg-amber-950 px-2 py-1 text-xs font-bold text-amber-200">Closing soon</span>}</div>
                <p className="mt-1 text-sm text-slate-400">{t.buyer_name || "Buyer not specified"} · {t.reference_number || "No reference"} · {t.province || "Province not set"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {#each [] as ignored}{/each}
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">Category: {(() => { const tenderCats=(t.categories||[]).map(x=>x.toLowerCase().trim()); const companyCats=[...(companies.find(c=>c.id===companyId)?.service_categories||[]),...(companies.find(c=>c.id===companyId)?.cidb_categories||[])].map(x=>x.toLowerCase().trim()); const matches=tenderCats.filter(x=>companyCats.includes(x)); return tenderCats.length===0?"Needs review":matches.length===0?"No direct match":matches.length===tenderCats.length?"Strong match":"Partial match"; })()}</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">Province: {(() => { const cp=companies.find(c=>c.id===companyId)?.province; return !t.province||!cp?"Needs review":t.province.toLowerCase()==="national"||cp.toLowerCase()===t.province.toLowerCase()?"Aligned":"Different region"; })()}</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">CSD: {companies.find(c=>c.id===companyId)?.csd_number?"Profile recorded":"Not recorded"}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Profile-based screening only—not a confirmed eligibility decision. Verify tender-specific CIDB, tax, briefing and mandatory returnable requirements.</p>
                <p className="mt-3 text-sm">Closing: <strong>{dateLabel(t.closing_at)}</strong></p>
                <p className="mt-1 text-sm text-slate-400">Clarification deadline: {dateLabel(t.clarification_deadline)}</p>
                {t.source_url && <a href={t.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-sky-300 underline">Open source notice</a>}
              </div>
              <label className="text-sm font-semibold">Lifecycle status
                <select value={t.status} onChange={e=>changeStatus(t,e.target.value)} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3">{states.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select>
              </label>
            </article>;
          })}</div>}
        </section>
      </>}
    </div>
  </main>;
}
