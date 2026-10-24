"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company={id:string;name:string};
type Tender={id:string;title:string;company_id:string;status:string};
type Proposal={id:string;company_id:string;tender_id:string;version:number;status:string;title:string;content:Record<string,unknown>;created_by:string;approved_by:string|null;approved_at:string|null;locked_at:string|null;created_at:string};
type Submission={id:string;tender_id:string;proposal_id:string;status:string;receipt_reference:string|null;created_at:string};

export default function ProposalsPage(){
 const router=useRouter();const [companies,setCompanies]=useState<Company[]>([]);const [companyId,setCompanyId]=useState("");
 const [tenders,setTenders]=useState<Tender[]>([]);const [tenderId,setTenderId]=useState("");
 const [proposals,setProposals]=useState<Proposal[]>([]);const [submissions,setSubmissions]=useState<Submission[]>([]);
 const [title,setTitle]=useState("");const [body,setBody]=useState("");const [,setSelected]=useState("");
 const [receipt,setReceipt]=useState("");const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [notice,setNotice]=useState("");

 async function load(cid:string,tid:string){
  const supabase=getSupabaseBrowserClient();
  const [{data:t,error:te},{data:p,error:pe},{data:s,error:se}]=await Promise.all([
   supabase.from("tenders").select("id,title,company_id,status").eq("company_id",cid).order("closing_at",{ascending:true,nullsFirst:false}),
   supabase.from("proposals").select("*").eq("company_id",cid).eq("tender_id",tid).order("version",{ascending:false}),
   supabase.from("submissions").select("id,tender_id,proposal_id,status,receipt_reference,created_at").eq("company_id",cid).eq("tender_id",tid).order("created_at",{ascending:false})
  ]);
  if(te)throw te;if(pe)throw pe;if(se)throw se;
  setTenders((t||[]) as Tender[]);setProposals((p||[]) as Proposal[]);setSubmissions((s||[]) as Submission[]);
 }
 useEffect(()=>{let active=true;async function init(){try{const supabase=getSupabaseBrowserClient();const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/auth");return;}
 const {data,error}=await supabase.from("companies").select("id,name").order("created_at",{ascending:true});if(error)throw error;if(!active)return;
 const list=(data||[]) as Company[];setCompanies(list);if(list[0]){setCompanyId(list[0].id);const {data:ts,error:te}=await supabase.from("tenders").select("id,title,company_id,status").eq("company_id",list[0].id).order("closing_at",{ascending:true,nullsFirst:false});if(te)throw te;const rows=(ts||[]) as Tender[];setTenders(rows);if(rows[0]){setTenderId(rows[0].id);await load(list[0].id,rows[0].id);}}}
 catch(e){if(active)setNotice(e instanceof Error?e.message:"Unable to load proposal workflow.");}finally{if(active)setLoading(false);}}init();return()=>{active=false;};},[router]);
 async function changeCompany(id:string){setCompanyId(id);setTenderId("");setProposals([]);setSubmissions([]);try{const supabase=getSupabaseBrowserClient();const {data,error}=await supabase.from("tenders").select("id,title,company_id,status").eq("company_id",id).order("closing_at",{ascending:true,nullsFirst:false});if(error)throw error;setTenders((data||[]) as Tender[]);}catch(e){setNotice(e instanceof Error?e.message:"Unable to load tenders.");}}
 async function changeTender(id:string){setTenderId(id);setSelected("");if(!id){setProposals([]);setSubmissions([]);return;}try{await load(companyId,id);}catch(e){setNotice(e instanceof Error?e.message:"Unable to load proposal records.");}}
 async function createProposal(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!companyId||!tenderId)return;setBusy(true);setNotice("");try{const supabase=getSupabaseBrowserClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in again to continue.");
 const nextVersion=(Math.max(0,...proposals.map(p=>p.version))+1);
 const {data,error}=await supabase.from("proposals").insert({company_id:companyId,tender_id:tenderId,version:nextVersion,status:"draft",title:title.trim(),content:{body:body.trim()},created_by:user.id}).select("*").single();if(error)throw error;
 setTitle("");setBody("");setSelected(data.id);await load(companyId,tenderId);setNotice("Proposal draft created. Review all claims and attachments before approval.");}catch(e){setNotice(e instanceof Error?e.message:"Unable to create proposal.");}finally{setBusy(false);}}
 async function transitionProposal(p:Proposal,next:"internal_review"|"approved"|"locked"){
  setBusy(true);setNotice("");try{const supabase=getSupabaseBrowserClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in again to continue.");
  const patch:Record<string,unknown>={status:next};
  if(next==="approved"){patch.approved_by=user.id;patch.approved_at=new Date().toISOString();}
  if(next==="locked"){patch.locked_at=new Date().toISOString();}
  const {error}=await supabase.from("proposals").update(patch).eq("id",p.id).eq("company_id",companyId);if(error)throw error;
  await load(companyId,tenderId);setNotice(next==="internal_review"?"Sent to internal review.":next==="approved"?"Proposal approved by the current account.":"Proposal locked against further edits.");}catch(e){setNotice(e instanceof Error?e.message:"Unable to update proposal status. Approval requires an owner, admin or tender manager role.");}finally{setBusy(false);}}
 async function createSubmission(p:Proposal){setBusy(true);setNotice("");try{const supabase=getSupabaseBrowserClient();const {error}=await supabase.from("submissions").insert({company_id:companyId,tender_id:tenderId,proposal_id:p.id,status:"pending_approval"});if(error)throw error;await load(companyId,tenderId);setNotice("Submission record created. This does not send anything to the tender issuer.");}catch(e){setNotice(e instanceof Error?e.message:"Unable to create submission record. A tender manager role may be required.");}finally{setBusy(false);}}
 async function submissionAction(s:Submission,action:"approve"|"submitted"|"receipt"){
  setBusy(true);setNotice("");try{const supabase=getSupabaseBrowserClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in again to continue.");
  const patch:Record<string,unknown>={};
  if(action==="approve"){patch.status="approved_to_submit";patch.approved_by=user.id;patch.approved_at=new Date().toISOString();}
  if(action==="submitted"){if(s.status!=="approved_to_submit")throw new Error("A submission must be approved before recording it as submitted.");patch.status="submitted";patch.submitted_by=user.id;patch.submitted_at=new Date().toISOString();}
  if(action==="receipt"){if(!receipt.trim())throw new Error("Enter the receipt reference first.");if(s.status!=="submitted"&&s.status!=="receipt_confirmed")throw new Error("Record the submission before confirming receipt.");patch.status="receipt_confirmed";patch.receipt_reference=receipt.trim();}
  const {error}=await supabase.from("submissions").update(patch).eq("id",s.id).eq("company_id",companyId);if(error)throw error;
  await load(companyId,tenderId);setNotice(action==="approve"?"Submission approved for manual sending.":action==="submitted"?"Submission marked as sent externally.":"Receipt reference recorded.");}catch(e){setNotice(e instanceof Error?e.message:"Unable to update submission. Check your role and required approvals.");}finally{setBusy(false);}}

 return <main className="min-h-screen px-5 py-8 md:px-10"><div className="mx-auto max-w-6xl"><Link href="/dashboard" className="text-sm font-semibold text-sky-300">← Workspace</Link>
 <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Proposal & submission control</p><h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Tender response room</h1>
 <p className="mt-3 max-w-3xl text-slate-400">Draft and review proposal versions, require an explicit approval step and track manual submission/receipt evidence. This screen does not auto-generate a final PDF or submit to an issuer.</p>
 {loading?<p className="mt-8 text-slate-400">Loading proposal workspace…</p>:companies.length===0?<section className="mt-8 rounded-xl border border-slate-700 p-6"><p>Create a company profile first.</p><Link className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-bold" href="/dashboard/company">Company profile</Link></section>:<>
 <div className="mt-7 grid gap-4 md:grid-cols-3"><label className="text-sm font-semibold">Company<select value={companyId} onChange={e=>changeCompany(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3">{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label className="text-sm font-semibold md:col-span-2">Tender<select value={tenderId} onChange={e=>changeTender(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3"><option value="">Select tender…</option>{tenders.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div>
 <form onSubmit={createProposal} className="mt-6 grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 className="text-xl font-bold">Create proposal draft</h2>
 <label className="text-sm font-semibold">Proposal title *<input required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" placeholder="Technical and commercial response"/></label>
 <label className="text-sm font-semibold">Draft content / response outline *<textarea required rows={6} value={body} onChange={e=>setBody(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-normal" placeholder="Scope understanding, methodology, programme, resources, quality, H&S, experience and commercial assumptions…"/></label>
 <div><button disabled={busy||!tenderId} className="rounded-lg bg-blue-600 px-5 py-3 font-bold disabled:opacity-50">{busy?"Saving…":"Create draft version"}</button></div></form>
 {notice&&<p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">{notice}</p>}
 <section className="mt-8 overflow-hidden rounded-2xl border border-slate-700"><div className="bg-slate-900 px-5 py-4"><h2 className="font-bold">Proposal versions</h2></div>
 {!tenderId?<p className="p-6 text-slate-400">Select a tender to continue.</p>:proposals.length===0?<p className="p-6 text-slate-400">No proposal versions created yet.</p>:<div className="divide-y divide-slate-800">{proposals.map(p=><article key={p.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{p.title}</h3><p className="mt-1 text-xs text-slate-400">Version {p.version} · created {new Date(p.created_at).toLocaleString()}</p></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold">{p.status.replaceAll("_"," ")}</span></div>
 <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 font-sans text-sm text-slate-300">{String(p.content?.body||"No draft content saved.")}</pre>
 <div className="mt-4 flex flex-wrap gap-2">{p.status==="draft"&&<button disabled={busy} onClick={()=>transitionProposal(p,"internal_review")} className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold">Request internal review</button>}
 {p.status==="internal_review"&&<button disabled={busy} onClick={()=>transitionProposal(p,"approved")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold">Approve proposal (manager)</button>}
 {p.status==="approved"&&<><button disabled={busy} onClick={()=>transitionProposal(p,"locked")} className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold">Lock approved version</button><button disabled={busy} onClick={()=>createSubmission(p)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold">Create submission record</button></>}
 {p.status==="locked"&&<button disabled={busy} onClick={()=>createSubmission(p)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold">Create submission record</button>}</div></article>)}</div>}</section>
 <section className="mt-8 overflow-hidden rounded-2xl border border-slate-700"><div className="bg-slate-900 px-5 py-4"><h2 className="font-bold">Submission controls & receipts</h2><p className="mt-1 text-sm text-slate-400">Approving here only authorizes a person to submit through the buyer&apos;s channel; it does not transmit the bid.</p></div>
 {submissions.length===0?<p className="p-6 text-slate-400">No submission records for this tender.</p>:<div className="divide-y divide-slate-800">{submissions.map(s=><article key={s.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">Submission · {s.proposal_id.slice(0,8)}</p><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold">{s.status.replaceAll("_"," ")}</span></div><p className="mt-1 text-xs text-slate-500">Created {new Date(s.created_at).toLocaleString()}</p>
 <div className="mt-4 flex flex-wrap gap-2">{s.status==="pending_approval"&&<button disabled={busy} onClick={()=>submissionAction(s,"approve")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold">Approve for submission</button>}{s.status==="approved_to_submit"&&<button disabled={busy} onClick={()=>submissionAction(s,"submitted")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold">Record as submitted externally</button>}
 {s.status==="submitted"&&<><input value={receipt} onChange={e=>setReceipt(e.target.value)} placeholder="Buyer receipt reference" className="min-w-52 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"/><button disabled={busy} onClick={()=>submissionAction(s,"receipt")} className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold">Confirm receipt</button></>}</div>{s.receipt_reference&&<p className="mt-2 text-sm text-slate-400">Receipt reference: {s.receipt_reference}</p>}</article>)}</div>}</section>
 </>}
 </div></main>;
}
