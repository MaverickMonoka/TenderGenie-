import Link from "next/link";

const features = [
  ["Tender Radar", "Track South African public-sector and private construction opportunities, eligibility criteria and deadlines."],
  ["QS & BOQ Estimating", "Build measured quantities, traceable rates, cost build-ups and commercial checks."],
  ["Compliance Vault", "Keep company returnables and tender evidence in private, company-scoped storage."],
  ["Proposal Governance", "Create versioned responses, request approvals and record submission evidence."],
];

export default function Home() {
  return <main className="min-h-screen px-5 py-10 md:px-10 md:py-16">
    <div className="mx-auto max-w-7xl">
      <nav className="flex items-center justify-between gap-4"><Link href="/" className="text-lg font-black tracking-tight">TENDER<span className="text-sky-300">genie</span><span className="ml-2 rounded bg-blue-600 px-2 py-1 text-xs text-white">AI</span></Link><Link href="/auth" className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold">Sign in</Link></nav>
      <section className="grid items-center gap-12 py-20 md:grid-cols-[1.2fr_.8fr] md:py-28">
        <div><p className="inline-flex rounded-full border border-sky-900 bg-sky-950/60 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Construction tender intelligence</p>
          <h1 className="mt-6 max-w-4xl text-5xl font-black leading-tight md:text-7xl">Win the work.<br/><span className="text-sky-300">Control every bid.</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Discover opportunities, assess eligibility, control compliance, price BOQs with traceable rates and govern every proposal through submission.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-500" href="/dashboard">Open workspace</Link><Link className="rounded-xl border border-slate-600 px-6 py-3 font-bold hover:border-sky-300" href="/dashboard/estimating">QS estimator</Link></div>
          <p className="mt-5 text-xs text-slate-500">Designed for construction contractors, estimators and tender teams.</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl">
          <div className="flex items-center justify-between"><p className="font-bold">Bid workflow</p><span className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-200">Controlled process</span></div>
          <div className="mt-5 space-y-3">{["Discover opportunity","Check eligibility","Review documents","Price the BOQ","Approve proposal","Record submission"].map((x,i)=><div key={x} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 font-bold text-sky-300">{String(i+1).padStart(2,"0")}</span><span className="font-semibold">{x}</span><span className="ml-auto text-slate-600">→</span></div>)}</div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Submission stays under human approval. AI assistance does not replace compliance verification or professional QS judgement.</p>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{features.map(([title,description])=><article key={title} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5"><div className="mb-4 h-1 w-12 rounded-full bg-sky-400"/><h2 className="text-lg font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{description}</p></article>)}</section>
      <footer className="mt-14 border-t border-slate-800 pt-5 text-xs text-slate-500">TenderGenie AI · Secure workflow foundation · Production integrations require environment configuration and verification.</footer>
    </div>
  </main>;
}
