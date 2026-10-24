import Link from "next/link";

const modules = [
  { title: "Tender Radar", description: "Track opportunities, sources, eligibility and closing deadlines.", href: "/dashboard/tenders", label: "Open tender register" },
  { title: "QS & Estimating", description: "BOQs, cost build-ups, overheads, profit and commercial review.", href: "/dashboard/estimating", label: "Open estimator" },
  { title: "Compliance", description: "Review mandatory returnables, evidence and qualification decisions.", href: "/dashboard/compliance", label: "Open compliance" },
  { title: "Company Profile", description: "Manage registration, tax, CIDB, CSD and service categories.", href: "/dashboard/company", label: "Manage company" },
  { title: "Document Vault", description: "Store company evidence and tender documents privately.", href: "/dashboard/documents", label: "Open vault" },
  { title: "Proposal & Submission", description: "Prepare proposal versions, approvals and submission records.", href: "/dashboard/proposals", label: "Open proposal workflow" },
];

export default function Dashboard() {
  return <main className="min-h-screen px-5 py-8 md:px-10">
    <div className="mx-auto max-w-7xl">
      <p className="font-bold tracking-[0.2em] text-sky-300">TENDERGENIE / WORKSPACE</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-4xl font-black">Bid control centre</h1><p className="mt-2 text-slate-400">One workspace for discovery, compliance, pricing and bid governance.</p></div>
        <Link href="/auth" className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold">Sign in / switch account</Link>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map(m=><Link key={m.title} href={m.href} className="group rounded-2xl border border-slate-700 bg-slate-900/70 p-6 hover:border-sky-400 hover:bg-slate-900">
        <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{m.title}</h2><span className="text-sky-300">↗</span></div>
        <p className="mt-3 min-h-12 text-sm leading-6 text-slate-400">{m.description}</p><p className="mt-5 text-sm font-bold text-sky-300">{m.label} →</p>
      </Link>)}</div>
      <p className="mt-8 rounded-xl border border-amber-900/70 bg-amber-950/30 p-4 text-sm text-amber-100">Production note: configure Supabase Auth and apply the reviewed database migration before using these modules with real company data. Tender discovery and document extraction are not yet automated.</p>
    </div>
  </main>;
}
