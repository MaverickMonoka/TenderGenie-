"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company = { id: string; name: string };
type Tender = { id: string; title: string; company_id: string };
type DocumentRow = { id: string; original_filename: string; document_type: string };
type Check = { id: string; tender_id: string; criterion: string; result: "pass"|"fail"|"review"|"unknown"; explanation: string; evidence_document_id: string|null; checked_at: string };

export default function CompliancePage() {
  const router = useRouter();
  const [companies,setCompanies] = useState<Company[]>([]);
  const [companyId,setCompanyId] = useState("");
  const [tenders,setTenders] = useState<Tender[]>([]);
  const [tenderId,setTenderId] = useState("");
  const [docs,setDocs] = useState<DocumentRow[]>([]);
  const [checks,setChecks] = useState<Check[]>([]);
  const [criterion,setCriterion] = useState("");
  const [result,setResult] = useState<Check["result"]>("review");
  const [explanation,setExplanation] = useState("");
  const [evidence,setEvidence] = useState("");
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState("");

  async function loadTenderData(cid:string, tid:string) {
    const supabase=getSupabaseBrowserClient();
    const [{data:t,error:te},{data:d,error:de},{data:c,error:ce}] = await Promise.all([
      supabase.from("tenders").select("id,title,company_id").eq("company_id",cid).order("closing_at",{ascending:true,nullsFirst:false}),
      supabase.from("documents").select("id,original_filename,document_type").eq("company_id",cid).order("created_at",{ascending:false}),
      tid ? supabase.from("eligibility_checks").select("*").eq("company_id",cid).eq("tender_id",tid).order("checked_at",{ascending:false}) : Promise.resolve({data:[],error:null} as any),
    ]);
    if(te) throw te; if(de) throw de; if(ce) throw ce;
    setTenders((t||[]) as Tender[]); setDocs((d||[]) as DocumentRow[]); setChecks((c||[]) as Check[]);
  }

  useEffect(()=>{let active=true;async function init(){try{
    const supabase=getSupabaseBrowserClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth");return;}
    const {data,error}=await supabase.from("companies").select("id,name").order("created_at",{ascending:true});if(error)throw error;
    if(!active)return;const list=(data||[]) as Company[];setCompanies(list);
    if(list[0]){setCompanyId(list[0].id);const {data:t,error:te}=await supabase.from("tenders").select("id,title,company_id").eq("company_id",list[0].id).order("closing_at",{ascending:true,nullsFirst:false});if(te)throw te;const ts=(t||[]) as Tender[];setTenders(ts);if(ts[0]){setTenderId(ts[0].id);await loadTenderData(list[0].id,ts[0].id);}else{const {data:d,error:de}=await supabase.from("documents").select("id,original_filename,document_type").eq("company_id",list[0].id);if(de)throw de;setDocs((d||[]) as DocumentRow[]);}}
  }catch(e){if(active)setNotice(e instanceof Error?e.message:"Unable to load compliance register.");}finally{if(active)setLoading(false);}}
  init();return()=>{active=false;};},[router]);

  async function switchCompany(id:string){setCompanyId(id);setTenderId("");setChecks([]);try{await loadTenderData(id,"");}catch(e){setNotice(e instanceof Error?e.message:"Unable to load company records.");}}
  async function switchTender(id:string){setTenderId(id);if(!id){setChecks([]);return;}try{await loadTenderData(companyId,id);}catch(e){setNotice(e instanceof Error?e.message:"Unable to load checks.");}}

  async function addCheck(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!companyId||!tenderId)return;setBusy(true);setNotice("");try{
    const supabase=getSupabaseBrowserClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in again to continue.");
    const {error}=await supabase.from("eligibility_checks").insert({company_id:companyId,tender_id:tenderId,criterion:criterion.trim(),result,explanation:explanation.trim(),evidence_document_id:evidence||null,checked_by:user.id});
    if(error)throw error;setCriterion("");setExplanation("");setEvidence("");await loadTenderData(companyId,tenderId);setNotice("Compliance check recorded. Human review is required before an extracted field can satisfy a mandatory criterion.");
  }catch(e){setNotice(e instanceof Error?e.message:"Unable to save compliance check.");}finally{setBusy(false);}}

  const counts={pass:checks.filter(c=>c.result==="pass").length,fail:checks.filter(c=>c.result==="fail").length,review:checks.filter(c=>c.result==="review"||c.result==="unknown").length};
  return <main className="min-h-screen px-5 py-8 md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="text-sm font-semibold text-sky-300">← Workspace</Link>
    <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Eligibility & compliance</p><h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Returnables checklist</h1>
    <p className="mt-3 max-w-3xl text-slate-400">Record tender eligibility criteria, pass/fail/review decisions, explanations and supporting evidence. This is a human-reviewed register; automatic document interpretation is not yet enabled.</p>
    {loading?<p className="mt-8 text-slate-400">Loading compliance records…</p>:companies.length===0?<section className="mt-8 rounded-xl border border-slate-700 p-6"><p>Create a company profile to start.</p><Link className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-bold" href="/dashboard/company">Company profile</Link></section>:<>
      <div className="mt-7 grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold">Company<select value={companyId} onChange={e=>switchCompany(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3">{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm font-semibold md:col-span-2">Tender<select value={tenderId} onChange={e=>switchTender(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3"><option value="">Select tender…</option>{tenders.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric title="Pass" value={counts.pass}/><Metric title="Fail" value={counts.fail}/><Metric title="Review required" value={counts.review}/></div>
      <form onSubmit={addCheck} className="mt-6 grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-6 md:grid-cols-2">
        <h2 className="text-xl font-bold md:col-span-2">Record eligibility / returnable check</h2>
        <label className="text-sm font-semibold md:col-span-2">Requirement or criterion *<input required value={criterion} onChange={e=>setCriterion(e.target.value)} maxLength={500} placeholder="Valid tax status, CIDB grade, compulsory briefing…" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal"/></label>
        <label className="text-sm font-semibold">Decision<select value={result} onChange={e=>setResult(e.target.value as Check["result"])} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3"><option value="pass">Pass</option><option value="fail">Fail</option><option value="review">Review required</option><option value="unknown">Not checked</option></select></label>
        <label className="text-sm font-semibold">Evidence document<select value={evidence} onChange={e=>setEvidence(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3"><option value="">No evidence linked</option>{docs.map(d=><option key={d.id} value={d.id}>{d.original_filename} · {d.document_type}</option>)}</select></label>
        <label className="text-sm font-semibold md:col-span-2">Reason / evidence notes *<textarea required value={explanation} onChange={e=>setExplanation(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" placeholder="Record the requirement, document date, expiry, or reason for review."/></label>
        <div className="md:col-span-2"><button disabled={busy||!tenderId} className="rounded-lg bg-blue-600 px-5 py-3 font-bold disabled:opacity-50">{busy?"Saving…":"Save compliance check"}</button></div>
      </form>
      {notice&&<p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">{notice}</p>}
      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-700"><div className="bg-slate-900 px-5 py-4"><h2 className="font-bold">Recorded checks</h2></div>{!tenderId?<p className="p-6 text-slate-400">Select a tender to view checks.</p>:checks.length===0?<p className="p-6 text-slate-400">No checks recorded for this tender.</p>:<div className="divide-y divide-slate-800">{checks.map(c=><article key={c.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{c.criterion}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${c.result==="pass"?"bg-emerald-950 text-emerald-200":c.result==="fail"?"bg-red-950 text-red-200":"bg-amber-950 text-amber-200"}`}>{c.result.replaceAll("_"," ")}</span></div><p className="mt-2 text-sm text-slate-300">{c.explanation}</p><p className="mt-2 text-xs text-slate-500">Checked {new Date(c.checked_at).toLocaleString()}</p></article>)}</div>}</section>
    </>}
  </div></main>;
}
function Metric({title,value}:{title:string;value:number}){return <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><p className="text-sm text-slate-400">{title}</p><p className="mt-1 text-2xl font-extrabold">{value}</p></div>}
