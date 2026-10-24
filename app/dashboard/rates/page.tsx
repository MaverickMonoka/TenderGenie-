"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company={id:string;name:string};
type DocumentRow={id:string;original_filename:string};
type Rate={id:string;description:string;trade:string;unit:string;rate_type:string;unit_rate:number;currency:string;region:string|null;effective_from:string;effective_to:string|null;assumptions:string|null;rate_source_id:string;rate_sources?:{source_name:string;source_type:string;source_reference:string|null;source_date:string|null;valid_until:string|null;notes:string|null}};

const sourceTypes=["supplier_quote","historical_actual","published_schedule","internal_rate","estimator_assumption","subcontractor_quote"];
const rateTypes=["material","labour","plant","subcontract","composite"];

export default function RateLibraryPage(){
 const router=useRouter();const [companies,setCompanies]=useState<Company[]>([]);const [companyId,setCompanyId]=useState("");
 const [docs,setDocs]=useState<DocumentRow[]>([]);const [rates,setRates]=useState<Rate[]>([]);
 const [sourceType,setSourceType]=useState("supplier_quote");const [sourceName,setSourceName]=useState("");const [sourceRef,setSourceRef]=useState("");const [sourceDate,setSourceDate]=useState(new Date().toISOString().slice(0,10));const [validUntil,setValidUntil]=useState("");const [sourceDoc,setSourceDoc]=useState("");const [sourceNotes,setSourceNotes]=useState("");
 const [description,setDescription]=useState("");const [trade,setTrade]=useState("General");const [unit,setUnit]=useState("m2");const [rateType,setRateType]=useState("material");const [unitRate,setUnitRate]=useState("0");const [region,setRegion]=useState("Limpopo");const [effectiveFrom,setEffectiveFrom]=useState(new Date().toISOString().slice(0,10));const [effectiveTo,setEffectiveTo]=useState("");const [assumptions,setAssumptions]=useState("");
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");

 async function load(cid:string){
  const supabase=getSupabaseBrowserClient();
  const [{data:r,error:re},{data:d,error:de}]=await Promise.all([
   supabase.from("construction_rates").select("id,description,trade,unit,rate_type,unit_rate,currency,region,effective_from,effective_to,assumptions,rate_source_id,rate_sources(source_name,source_type,source_reference,source_date,valid_until,notes)").eq("company_id",cid).order("effective_from",{ascending:false}).limit(200),
   supabase.from("documents").select("id,original_filename").eq("company_id",cid).order("created_at",{ascending:false}),
  ]);
  if(re)throw re;if(de)throw de;setRates((r||[]) as unknown as Rate[]);setDocs((d||[]) as DocumentRow[]);
 }
 useEffect(()=>{let active=true;async function init(){try{const supabase=getSupabaseBrowserClient();const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/auth");return;}
 const {data,error}=await supabase.from("companies").select("id,name").order("created_at",{ascending:true});if(error)throw error;if(!active)return;const list=(data||[]) as Company[];setCompanies(list);if(list[0]){setCompanyId(list[0].id);await load(list[0].id);}}
 catch(e){if(active)setNotice(e instanceof Error?e.message:"Unable to load rate library.");}finally{if(active)setLoading(false);}}init();return()=>{active=false;};},[router]);
 async function switchCompany(id:string){setCompanyId(id);try{await load(id);}catch(e){setNotice(e instanceof Error?e.message:"Unable to load company rates.");}}
 async function addRate(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!companyId)return;setBusy(true);setNotice("");try{
  const supabase=getSupabaseBrowserClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in again to continue.");
  const rate=Number(unitRate);if(!Number.isFinite(rate)||rate<0)throw new Error("Enter a valid non-negative rate.");
  if(validUntil&&sourceDate&&validUntil<sourceDate)throw new Error("Source validity date cannot be before the source date.");
  if(effectiveTo&&effectiveFrom&&effectiveTo<effectiveFrom)throw new Error("Rate end date cannot be before its effective date.");
  if(sourceType==="estimator_assumption"&&!sourceNotes.trim())throw new Error("An estimator assumption requires written notes.");
  const {data:src,error:srcError}=await supabase.from("rate_sources").insert({
   company_id:companyId,source_type:sourceType,source_name:sourceName.trim(),source_reference:sourceRef.trim()||null,
   source_date:sourceDate||null,valid_until:validUntil||null,document_id:sourceDoc||null,notes:sourceNotes.trim()||null,created_by:user.id,
  }).select("id").single();if(srcError)throw srcError;
  const {error}=await supabase.from("construction_rates").insert({
   company_id:companyId,rate_source_id:src.id,description:description.trim(),trade:trade.trim(),unit:unit.trim(),rate_type:rateType,
   unit_rate:rate,currency:"ZAR",region:region.trim()||null,effective_from:effectiveFrom,effective_to:effectiveTo||null,
   assumptions:assumptions.trim()||null,created_by:user.id,
  });if(error)throw error;
  setDescription("");setUnitRate("0");setAssumptions("");await load(companyId);setNotice("Rate saved with source provenance. Confirm the source is current and applicable to this project before using it in a tender.");
 }catch(e){setNotice(e instanceof Error?e.message:"Unable to save construction rate. Check your company role and migration.");}finally{setBusy(false);}}
 return <main className="min-h-screen px-5 py-8 md:px-10"><div className="mx-auto max-w-7xl"><Link href="/dashboard" className="text-sm font-semibold text-sky-300">← Workspace</Link>
 <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Quantity surveying</p><h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Construction rate library</h1>
 <p className="mt-3 max-w-3xl text-slate-400">Record material, labour, plant, subcontract and composite rates in ZAR, linked to supplier quotes, historical actuals, published schedules or explicit estimator assumptions.</p>
 {loading?<p className="mt-8 text-slate-400">Loading rate library…</p>:companies.length===0?<section className="mt-8 rounded-xl border border-slate-700 p-6"><p>Create a company profile before maintaining rates.</p><Link className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-bold" href="/dashboard/company">Company profile</Link></section>:<>
 <div className="mt-7"><label className="text-sm font-semibold">Company<select value={companyId} onChange={e=>switchCompany(e.target.value)} className="ml-3 rounded-lg border border-slate-600 bg-slate-950 px-3 py-3">{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
 <form onSubmit={addRate} className="mt-6 grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-6 md:grid-cols-3">
  <h2 className="text-xl font-bold md:col-span-3">Add traceable rate</h2>
  <label className="text-sm font-semibold">Source type<select value={sourceType} onChange={e=>setSourceType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3">{sourceTypes.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label>
  <label className="text-sm font-semibold md:col-span-2">Source name *<input required value={sourceName} onChange={e=>setSourceName(e.target.value)} placeholder="Supplier quote, contract rate, schedule…" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold">Source reference / quote number<input value={sourceRef} onChange={e=>setSourceRef(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold">Source date<input type="date" value={sourceDate} onChange={e=>setSourceDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold">Source valid until<input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold">Supporting document (optional)<select value={sourceDoc} onChange={e=>setSourceDoc(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"><option value="">No linked document</option>{docs.map(d=><option key={d.id} value={d.id}>{d.original_filename}</option>)}</select></label>
  <label className="text-sm font-semibold md:col-span-3">Source notes / verification context{sourceType==="estimator_assumption"?" *":""}<textarea required={sourceType==="estimator_assumption"} value={sourceNotes} onChange={e=>setSourceNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal" placeholder="Supplier, validity, inclusions/exclusions, location or assumption basis…"/></label>
  <div className="md:col-span-3 border-t border-slate-700 pt-4"><h3 className="font-bold">Rate details</h3></div>
  <label className="text-sm font-semibold md:col-span-2">Description *<input required value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal" placeholder="Ready-mix concrete 25 MPa, supply only…"/></label>
  <label className="text-sm font-semibold">Trade *<input required value={trade} onChange={e=>setTrade(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold">Rate type<select value={rateType} onChange={e=>setRateType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3">{rateTypes.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
  <label className="text-sm font-semibold">Unit *<input required value={unit} onChange={e=>setUnit(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal" placeholder="m3, m2, hr, item"/></label>
  <label className="text-sm font-semibold">Unit rate (ZAR) *<input required type="number" min="0" step="0.0001" value={unitRate} onChange={e=>setUnitRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold">Region<input value={region} onChange={e=>setRegion(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold">Effective from<input required type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold">Effective to (optional)<input type="date" value={effectiveTo} onChange={e=>setEffectiveTo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <label className="text-sm font-semibold md:col-span-3">Rate assumptions / inclusions / exclusions<textarea value={assumptions} onChange={e=>setAssumptions(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-normal"/></label>
  <div className="md:col-span-3"><button disabled={busy} className="rounded-lg bg-blue-600 px-5 py-3 font-bold disabled:opacity-50">{busy?"Saving rate…":"Save traceable rate"}</button></div>
 </form>
 {notice&&<p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">{notice}</p>}
 <section className="mt-8 overflow-hidden rounded-2xl border border-slate-700"><div className="bg-slate-900 px-5 py-4"><h2 className="font-bold">Saved construction rates</h2><p className="mt-1 text-sm text-slate-400">{rates.length} latest records</p></div>
 {rates.length===0?<p className="p-6 text-slate-400">No construction rates saved for this company yet.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-4">Description / trade</th><th className="p-4">Unit</th><th className="p-4">Rate</th><th className="p-4">Source</th><th className="p-4">Region</th><th className="p-4">Validity</th></tr></thead><tbody>{rates.map(r=><tr key={r.id} className="border-t border-slate-800"><td className="p-4"><p className="font-semibold">{r.description}</p><p className="mt-1 text-xs text-slate-400">{r.trade} · {r.rate_type}</p>{r.assumptions&&<p className="mt-1 text-xs text-slate-500">{r.assumptions}</p>}</td><td className="p-4">{r.unit}</td><td className="p-4 font-bold">R {Number(r.unit_rate).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:4})}</td><td className="p-4">{r.rate_sources?.source_name||"Source record"}<p className="mt-1 text-xs text-slate-400">{r.rate_sources?.source_type?.replaceAll("_"," ")||"Unspecified"}</p>{r.rate_sources?.source_reference&&<p className="text-xs text-slate-500">{r.rate_sources.source_reference}</p>}</td><td className="p-4">{r.region||"Not specified"}</td><td className="p-4">{r.effective_from}{r.effective_to?" – "+r.effective_to:" onward"}{r.rate_sources?.valid_until&&<p className="mt-1 text-xs text-amber-300">Source valid to {r.rate_sources.valid_until}</p>}</td></tr>)}</tbody></table></div>}
 </section>
 <p className="mt-5 rounded-xl border border-amber-900/70 bg-amber-950/30 p-4 text-sm text-amber-100">Rate records retain provenance, but the application does not yet certify a source as authoritative or automatically reconcile every BOQ line to the rate library.</p>
 </>}
 </div></main>;
}
