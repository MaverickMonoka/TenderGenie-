"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company = { id: string; name: string };
type StoredDocument = { id: string; original_filename: string; document_type: string; byte_size: number; extraction_status: string; created_at: string };

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain",
]);
const maxBytes = 25 * 1024 * 1024;

export default function DocumentsPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("company_returnable");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function refresh(company: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("documents")
      .select("id,original_filename,document_type,byte_size,extraction_status,created_at")
      .eq("company_id", company).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    setDocuments((data || []) as StoredDocument[]);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/auth"); return; }
        const { data, error } = await supabase.from("companies").select("id,name").order("created_at", { ascending: true });
        if (error) throw error;
        if (!active) return;
        const rows = (data || []) as Company[];
        setCompanies(rows);
        if (rows[0]) {
          setCompanyId(rows[0].id);
          await refresh(rows[0].id);
        }
      } catch (e) {
        if (active) setNotice(e instanceof Error ? e.message : "Unable to load document vault.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [router]);

  async function changeCompany(id: string) {
    setCompanyId(id);
    setNotice("");
    try { await refresh(id); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Unable to load documents."); }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setNotice("");
    if (selected && !allowedTypes.has(selected.type)) {
      setFile(null);
      setNotice("This file type is not allowed. Upload PDF, Office documents, PNG, JPEG or plain text.");
      event.target.value = "";
      return;
    }
    if (selected && selected.size > maxBytes) {
      setFile(null);
      setNotice("File exceeds the 25 MB limit.");
      event.target.value = "";
      return;
    }
    setFile(selected);
  }

  async function upload() {
    if (!file || !companyId) return;
    setBusy(true);
    setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Sign in again.");
      // The company UUID is the first path segment required by the Storage RLS policy.
      // The random key prevents user-controlled paths and filename collisions.
      const path = `${companyId}/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage.from("tender-documents").upload(path, file, {
        contentType: file.type,
        cacheControl: "0",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: metadataError } = await supabase.from("documents").insert({
        company_id: companyId,
        storage_path: path,
        original_filename: file.name.slice(0, 255),
        mime_type: file.type,
        byte_size: file.size,
        document_type: documentType,
        uploaded_by: user.id,
        extraction_status: "pending",
      });
      if (metadataError) {
        // Avoid leaving an unindexed private object if metadata insertion fails.
        await supabase.storage.from("tender-documents").remove([path]);
        throw metadataError;
      }
      setFile(null);
      const input = document.getElementById("document-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await refresh(companyId);
      setNotice("File uploaded to the private company vault. Extraction is not yet configured.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: doc, error } = await supabase.from("documents").select("storage_path,original_filename").eq("id", id).single();
      if (error) throw error;
      const { data, error: signedError } = await supabase.storage.from("tender-documents").createSignedUrl(doc.storage_path, 60);
      if (signedError) throw signedError;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to create a secure download link.");
    }
  }

  return <main className="min-h-screen px-5 py-8 md:px-10">
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="text-sm font-semibold text-sky-300">← Workspace</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Private company vault</p>
      <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Document storage</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Files are stored in a private bucket, with company membership enforced by Storage policies. Downloads use short-lived signed URLs. This screen does not yet run OCR or compliance extraction.</p>
      {loading ? <p className="mt-8 text-slate-400">Loading secure vault…</p> : companies.length === 0 ? <section className="mt-8 rounded-xl border border-slate-700 p-6"><p>No company profile found. Create one before uploading documents.</p><Link className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-bold" href="/dashboard/company">Create company profile</Link></section> : <>
        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold">Company
              <select value={companyId} onChange={e=>changeCompany(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3">
                {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Document type
              <select value={documentType} onChange={e=>setDocumentType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3">
                <option value="company_returnable">Company returnable</option><option value="tax_compliance">Tax compliance</option><option value="cidb">CIDB evidence</option><option value="csd">CSD evidence</option><option value="supplier_quote">Supplier quotation</option><option value="tender_document">Tender document</option><option value="boq">BOQ / pricing</option><option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Select file (max 25 MB)
              <input id="document-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={chooseFile} className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-bold file:text-white" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button disabled={!file || busy} onClick={upload} className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Uploading securely…" : "Upload to private vault"}</button>
            {file && <span className="text-sm text-slate-400">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
          </div>
        </section>
        {notice && <p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">{notice}</p>}
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-700">
          <div className="flex items-center justify-between bg-slate-900 px-5 py-4"><h2 className="font-bold">Stored documents</h2><span className="text-sm text-slate-400">{documents.length} shown</span></div>
          {documents.length === 0 ? <p className="p-6 text-slate-400">No documents uploaded for this company yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-4">File</th><th className="p-4">Type</th><th className="p-4">Size</th><th className="p-4">Extraction</th><th className="p-4">Access</th></tr></thead><tbody>{documents.map(d=><tr key={d.id} className="border-t border-slate-800"><td className="max-w-xs truncate p-4 font-semibold">{d.original_filename}</td><td className="p-4">{d.document_type.replaceAll("_"," ")}</td><td className="p-4">{(d.byte_size/1024/1024).toFixed(2)} MB</td><td className="p-4"><span className="rounded-full bg-slate-800 px-2 py-1">{d.extraction_status}</span></td><td className="p-4"><button onClick={()=>download(d.id)} className="font-semibold text-sky-300 underline">Secure download</button></td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </div>
  </main>;
}
