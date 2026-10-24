"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Row = { id: number; desc: string; unit: string; qty: number; material: number; labour: number; plant: number; subcontract: number };
type Company = { id: string; name: string };
type Tender = { id: string; title: string };
type SavedBOQ = { id: string; name: string; revision: number; status: string; created_at: string };
type ReferenceRate = { id: string; description: string; unit: string; unit_rate: number; rate_type: string; effective_from: string; effective_to: string | null; rate_sources: { valid_until: string | null } | null };

const seed: Row[] = [{ id: 1, desc: "Example BOQ item", unit: "m3", qty: 100, material: 0, labour: 0, plant: 0, subcontract: 0 }];

export default function Estimating() {
  const router = useRouter();
  const [rows, setRows] = useState(seed);
  const [oh, setOh] = useState(10);
  const [profit, setProfit] = useState(10);
  const [projectName, setProjectName] = useState("Tender estimate");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [tenderId, setTenderId] = useState("");
  const [saved, setSaved] = useState<SavedBOQ[]>([]);
  const [referenceRates, setReferenceRates] = useState<ReferenceRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const direct = useMemo(() => rows.reduce((s, r) => s + Math.max(0,r.qty) * (Math.max(0,r.material) + Math.max(0,r.labour) + Math.max(0,r.plant) + Math.max(0,r.subcontract)), 0), [rows]);
  const overheadAmount = direct * Math.max(0,oh) / 100;
  const tenderTotal = (direct + overheadAmount) * (1 + Math.max(0,profit) / 100);

  async function loadSaved(cid: string) {
    const supabase = getSupabaseBrowserClient();
    const [{data,error},{data:rateRows,error:rateError}] = await Promise.all([
      supabase.from("boq_projects").select("id,name,revision,status,created_at").eq("company_id",cid).order("created_at",{ascending:false}).limit(20),
      supabase.from("construction_rates").select("id,description,unit,unit_rate,rate_type,effective_from,effective_to,rate_sources(valid_until)").eq("company_id",cid).eq("rate_type","composite").order("effective_from",{ascending:false}).limit(500),
    ]);
    if (error) throw error;
    if (rateError) throw rateError;
    setSaved((data || []) as SavedBOQ[]);
    setReferenceRates((rateRows || []) as unknown as ReferenceRate[]);
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/auth"); return; }
        const { data, error } = await supabase.from("companies").select("id,name").order("created_at",{ascending:true});
        if (error) throw error;
        if (!active) return;
        const list = (data || []) as Company[];
        setCompanies(list);
        if (list[0]) {
          setCompanyId(list[0].id);
          const { data: tenderRows, error: tenderError } = await supabase.from("tenders").select("id,title").eq("company_id",list[0].id).order("closing_at",{ascending:true,nullsFirst:false});
          if (tenderError) throw tenderError;
          setTenders((tenderRows || []) as Tender[]);
          await loadSaved(list[0].id);
        }
      } catch (e) { if (active) setNotice(e instanceof Error ? e.message : "Unable to load estimator workspace."); }
      finally { if (active) setLoading(false); }
    }
    init();
    return () => { active = false; };
  }, [router]);

  function referenceFor(row: Row): ReferenceRate | undefined {
    const today = new Date().toISOString().slice(0,10);
    return referenceRates.find(rate =>
      rate.description.trim().toLowerCase() === row.desc.trim().toLowerCase() &&
      rate.unit.trim().toLowerCase() === row.unit.trim().toLowerCase() &&
      rate.effective_from <= today && (!rate.effective_to || rate.effective_to >= today) &&
      (!rate.rate_sources?.valid_until || rate.rate_sources.valid_until >= today)
    );
  }

  function edit(id:number,k:keyof Row,v:string) {
    setRows(x=>x.map(r=>r.id===id?{...r,[k]:k==="desc"||k==="unit"?v:Math.max(0,Number(v)||0)}:r));
  }

  async function changeCompany(id:string) {
    setCompanyId(id);setTenderId("");setTenders([]);setSaved([]);
    try {
      const supabase=getSupabaseBrowserClient();
      const [{data:t,error:te}] = await Promise.all([supabase.from("tenders").select("id,title").eq("company_id",id).order("closing_at",{ascending:true,nullsFirst:false})]);
      if(te)throw te;setTenders((t||[]) as Tender[]);await loadSaved(id);
    } catch(e) { setNotice(e instanceof Error?e.message:"Unable to load company estimate records."); }
  }

  async function saveEstimate() {
    if (!companyId) { setNotice("Create a company profile before saving estimates."); return; }
    if (!projectName.trim()) { setNotice("Enter an estimate name."); return; }
    if (rows.some(r=>!r.desc.trim()||!r.unit.trim())) { setNotice("Every BOQ line needs a description and unit."); return; }
    setSaving(true);setNotice("");
    try {
      const supabase=getSupabaseBrowserClient();
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error("Sign in again to continue.");
      const sourceNotes="Estimator-entered component build-up. Validate material, labour, plant and subcontract values against current supplier quotations or approved historical rates before tender submission.";
      const {data:source,error:sourceError}=await supabase.from("rate_sources").insert({
        company_id:companyId,source_type:"estimator_assumption",source_name:"TenderGenie estimator-entered build-up",
        source_date:new Date().toISOString().slice(0,10),notes:sourceNotes,created_by:user.id,
      }).select("id").single();
      if(sourceError)throw sourceError;
      const {data:project,error:projectError}=await supabase.from("boq_projects").insert({
        company_id:companyId,tender_id:tenderId||null,name:projectName.trim(),revision:1,status:"draft",
        preliminaries:Number(overheadAmount.toFixed(2)),contingency_percent:0,markup_percent:Math.max(0,profit),created_by:user.id,
      }).select("id").single();
      if(projectError)throw projectError;
      const items=rows.map((r,index)=>({
        company_id:companyId,boq_project_id:project.id,item_number:String(index+1).padStart(3,"0"),
        description:r.desc.trim(),unit:r.unit.trim(),quantity:Math.max(0,r.qty),
        unit_rate:Number((Math.max(0,r.material)+Math.max(0,r.labour)+Math.max(0,r.plant)+Math.max(0,r.subcontract)).toFixed(4)),
        rate_basis:"estimator_assumption",rate_source_id:source.id,
        rate_note:`Estimator-entered build-up: material R${r.material.toFixed(2)}, labour R${r.labour.toFixed(2)}, plant R${r.plant.toFixed(2)}, subcontract R${r.subcontract.toFixed(2)} per ${r.unit}. Validate before submission.`,
      }));
      const {error:itemsError}=await supabase.from("boq_items").insert(items);
      if(itemsError)throw itemsError;
      await loadSaved(companyId);
      setNotice("Estimate saved to the company workspace with rate provenance. All entered rates are marked as assumptions and require verification before submission.");
    } catch(e) { setNotice(e instanceof Error?e.message:"Unable to save estimate. Check your company role and database migration."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen p-6 md:p-8"><div className="mx-auto max-w-7xl">
    <Link href="/dashboard" className="text-sm font-semibold text-sky-300">← Workspace</Link>
    <p className="mt-5 font-bold text-sky-300">QS & ESTIMATING ENGINE</p><h1 className="mt-2 text-3xl font-black md:text-4xl">Commercial estimate</h1>
    <p className="mt-2 max-w-3xl text-slate-400">Build a traceable BOQ. Values entered manually are stored as estimator assumptions—not verified market prices—and must be checked before a bid is approved.</p>
    <div className="mt-6 grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-5 md:grid-cols-3">
      <label className="text-sm font-semibold">Company<select value={companyId} onChange={e=>changeCompany(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" disabled={loading||companies.length===0}><option value="">Select company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Linked tender (optional)<select value={tenderId} onChange={e=>setTenderId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"><option value="">Standalone estimate</option>{tenders.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <label className="text-sm font-semibold">Estimate name<input value={projectName} onChange={e=>setProjectName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"/></label>
    </div>
    <div className="mt-6 overflow-auto rounded-2xl border border-slate-700"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-slate-900"><tr>{["Description","Unit","Qty","Material rate","Labour rate","Plant rate","Subcontract rate","Direct amount","Reference check"].map(x=><th className="p-3 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(r=>{const rate=r.material+r.labour+r.plant+r.subcontract;return <tr className="border-t border-slate-800" key={r.id}><td className="p-2"><input aria-label="BOQ description" className="w-64 bg-transparent" value={r.desc} onChange={e=>edit(r.id,"desc",e.target.value)}/></td><td className="p-2"><input aria-label="Unit" className="w-16 bg-transparent" value={r.unit} onChange={e=>edit(r.id,"unit",e.target.value)}/></td>{(["qty","material","labour","plant","subcontract"] as const).map(k=><td className="p-2" key={k}><input aria-label={k} type="number" min="0" step="any" className="w-24 rounded bg-slate-950 p-2" value={r[k]} onChange={e=>edit(r.id,k,e.target.value)}/></td>)}<td className="p-3 font-bold">R {(r.qty*rate).toLocaleString("en-ZA",{maximumFractionDigits:2})}</td><td className="p-3">{(() => { const ref=referenceFor(r); if(!ref)return <span className="text-slate-500">No matching composite rate</span>; if(Number(ref.unit_rate)===0)return <span className="text-amber-300">Zero-rate reference · review</span>; const variance=((rate-Number(ref.unit_rate))/Number(ref.unit_rate))*100; return Math.abs(variance)>10?<span className="font-bold text-amber-300">{variance>0?"+":""}{variance.toFixed(1)}% variance vs R {Number(ref.unit_rate).toFixed(2)}</span>:<span className="text-sky-300">Within 10% of R {Number(ref.unit_rate).toFixed(2)}</span>; })()}</td></tr>})}</tbody></table></div>
    <div className="mt-4 flex flex-wrap gap-3"><button onClick={()=>setRows(x=>[...x,{id:Date.now(),desc:"New BOQ item",unit:"item",qty:1,material:0,labour:0,plant:0,subcontract:0}])} className="rounded-lg border border-slate-600 px-4 py-2 font-semibold">Add BOQ item</button><button disabled={saving||loading||!companyId} onClick={saveEstimate} className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50">{saving?"Saving estimate…":"Save estimate to workspace"}</button></div>
    <p className="mt-3 text-xs text-slate-500">Reference check compares exact description/unit matches against current composite rates from your company library. A variance over 10% is a review flag, not proof of an error.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-4"><Metric title="Direct cost" value={direct}/><Control title="Overheads %" value={oh} setValue={setOh}/><Control title="Profit %" value={profit} setValue={setProfit}/><Metric title="Tender price estimate" value={tenderTotal}/></div>
    {notice&&<p role="status" className="mt-5 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">{notice}</p>}
    <p className="mt-4 text-sm"><Link href="/dashboard/rates" className="font-semibold text-sky-300 underline">Open construction rate library →</Link></p>
    <section className="mt-8 rounded-2xl border border-slate-700 p-5"><h2 className="text-xl font-bold">Saved estimates</h2><p className="mt-1 text-sm text-slate-400">Latest estimates in this company workspace.</p>{loading?<p className="mt-4 text-slate-400">Loading saved estimates…</p>:saved.length===0?<p className="mt-4 text-slate-400">No saved BOQs yet.</p>:<div className="mt-4 divide-y divide-slate-800">{saved.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{p.name}</p><p className="mt-1 text-xs text-slate-400">Revision {p.revision} · {new Date(p.created_at).toLocaleString()}</p></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold">{p.status}</span></div>)}</div>}</section>
    <div className="mt-6 rounded-xl border border-amber-900/70 bg-amber-950/30 p-4 text-sm text-amber-100">Pricing control: the saved BOQ records the component build-up and assumption note for each line. It does not certify market rates, replace QS review or automatically approve a tender.</div>
  </div></main>;
}
function Metric({title,value}:{title:string;value:number}){return <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><p className="text-sm text-slate-400">{title}</p><p className="mt-2 text-2xl font-black">R {value.toLocaleString("en-ZA",{maximumFractionDigits:2})}</p></div>}
function Control({title,value,setValue}:{title:string;value:number;setValue:(n:number)=>void}){return <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><label className="text-sm text-slate-400">{title}<input type="number" min="0" step="any" className="mt-2 w-full rounded bg-slate-950 p-2 text-white" value={value} onChange={e=>setValue(Math.max(0,Number(e.target.value)||0))}/></label></div>}
