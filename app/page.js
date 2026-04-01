"use client";
import { useState, useCallback } from "react";

const CATEGORIES = {
  "Frontend":        { keywords: ["frontend", "front-end", "react", "vue", "angular", "ui developer", "next.js", "nuxt", "svelte"], color: "#00d4ff" },
  "Backend":         { keywords: ["backend", "back-end", "node.js", "python developer", "java developer", "php developer", "golang", "spring", "django", ".net developer", "c# developer", "scala"], color: "#7c3aed" },
  "Fullstack":       { keywords: ["fullstack", "full-stack", "full stack"], color: "#06b6d4" },
  "Mobile":          { keywords: ["android", "ios", "mobile developer", "flutter", "react native", "swift", "kotlin"], color: "#10b981" },
  "DevOps / Infra":  { keywords: ["devops", "sre", "platform engineer", "cloud engineer", "kubernetes", "docker", "terraform", "ci/cd"], color: "#f59e0b" },
  "Data / Analytics":{ keywords: ["data engineer", "data analyst", "data scientist", "bi developer", "etl", "spark", "snowflake", "databricks"], color: "#f97316" },
  "AI / ML":         { keywords: ["machine learning", "ai engineer", "ml engineer", "nlp", "computer vision", "llm", "deep learning"], color: "#ec4899" },
  "QA / Testing":    { keywords: ["qa engineer", "quality assurance", "test engineer", "automation tester", "selenium", "cypress", "playwright"], color: "#84cc16" },
  "Product":         { keywords: ["product manager", "product owner", "scrum master", "agile coach", "business analyst"], color: "#a855f7" },
  "Design":          { keywords: ["ux designer", "ui designer", "product designer", "figma", "ux researcher"], color: "#fb923c" },
  "Security":        { keywords: ["security engineer", "cybersecurity", "penetration tester", "infosec", "appsec"], color: "#ef4444" },
};

function categorize(job) {
  const text = `${job.job_title || job.title || ""} ${job.description || ""}`.toLowerCase();
  for (const [cat, data] of Object.entries(CATEGORIES)) {
    if (data.keywords.some(k => text.includes(k))) return cat;
  }
  return "Ostalo";
}

function getWorkType(job) {
  const text = `${job.job_type || ""} ${job.location || ""} ${job.description || ""}`.toLowerCase();
  if (text.includes("remote")) return "remote";
  if (text.includes("hybrid") || text.includes("hibrid")) return "hybrid";
  return "onsite";
}

function formatDate(job) {
  if (job.date) {
    try { return new Date(job.date).toLocaleDateString("sr-Latn", { day: "numeric", month: "short" }); } catch (e) {}
  }
  return job.posted_at || "";
}

// Proxy helper — sve ide kroz /api/apify
async function apifyPost(path, body) {
  const resp = await fetch("/api/apify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, body }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

async function apifyGet(path) {
  const resp = await fetch(`/api/apify?path=${encodeURIComponent(path)}`);
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

export default function JobBoard() {
  const [token, setToken]           = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [maxResults, setMaxResults] = useState("50");
  const [jobs, setJobs]             = useState([]);
  const [logs, setLogs]             = useState([{ text: "Spreman za scrape...", type: "" }]);
  const [loading, setLoading]       = useState(false);
  const [progress, setProgress]     = useState(0);
  const [activeCat, setActiveCat]   = useState("all");
  const [search, setSearch]         = useState("");
  const [sort, setSort]             = useState("date");

  const log = useCallback((text, type = "") => {
    const time = new Date().toLocaleTimeString("sr", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev.slice(-30), { text: `[${time}] ${text}`, type }]);
  }, []);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function startScrape() {
    if (!token)       { log("⚠ Unesi Apify API token", "err"); return; }
    if (!linkedinUrl) { log("⚠ Unesi LinkedIn URL", "err"); return; }

    setLoading(true);
    setProgress(10);
    log("Pokrećem Apify actor...", "info");

    try {
      // 1. Start run
      const runData = await apifyPost(
        `/v2/acts/curious_coder~linkedin-jobs-scraper/runs?token=${token}`,
        { startUrls: [{ url: linkedinUrl }], count: parseInt(maxResults) || 50, proxy: { useApifyProxy: true } }
      );

      const runId = runData.data?.id;
      if (!runId) throw new Error("Nema run ID u odgovoru od Apify");
      log(`Run pokrenut: ${runId}`, "ok");
      setProgress(25);

      // 2. Poll status
      let status = "RUNNING";
      let attempts = 0;
      while (["RUNNING", "READY"].includes(status)) {
        await sleep(3000);
        attempts++;
        const sd = await apifyGet(`/v2/actor-runs/${runId}?token=${token}`);
        status = sd.data?.status;
        setProgress(Math.min(25 + attempts * 5, 78));
        log(`Status: ${status}`, "");
        if (attempts > 60) throw new Error("Timeout — scrape traje predugo (>3 min)");
      }

      if (status !== "SUCCEEDED") throw new Error(`Run završen sa statusom: ${status}`);
      log("Scrape završen, učitavam rezultate...", "info");
      setProgress(85);

      // 3. Fetch dataset
      const runInfo   = await apifyGet(`/v2/actor-runs/${runId}?token=${token}`);
      const datasetId = runInfo.data?.defaultDatasetId;
      if (!datasetId) throw new Error("Nema dataset ID");

      const itemsData = await apifyGet(`/v2/datasets/${datasetId}/items?token=${token}&format=json`);
      const items     = Array.isArray(itemsData) ? itemsData : itemsData?.items || [];

      if (!items.length) throw new Error("Nema rezultata — pokušaj sa drugačijim LinkedIn URL-om");

      const categorized = items.map(job => ({
        ...job,
        _cat:  categorize(job),
        _work: getWorkType(job),
        _date: formatDate(job),
      }));

      setJobs(categorized);
      setProgress(100);
      log(`✓ Učitano ${items.length} oglasa u ${Object.keys(
        categorized.reduce((a, j) => ({ ...a, [j._cat]: 1 }), {})
      ).length} kategorija`, "ok");
      setTimeout(() => setProgress(0), 1000);

    } catch (err) {
      log(`Greška: ${err.message}`, "err");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  }

  // Filtered + sorted
  const filtered = jobs.filter(j => {
    if (activeCat !== "all" && j._cat !== activeCat) return false;
    if (search) {
      const t = `${j.job_title || j.title || ""} ${j.company_name || j.company || ""} ${j.location || ""}`.toLowerCase();
      if (!t.includes(search.toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sort === "company") return (a.company_name || "").localeCompare(b.company_name || "");
    if (sort === "title")   return (a.job_title || a.title || "").localeCompare(b.job_title || b.title || "");
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  const grouped = {};
  filtered.forEach(j => { if (!grouped[j._cat]) grouped[j._cat] = []; grouped[j._cat].push(j); });

  const catCounts  = {};
  jobs.forEach(j => { catCounts[j._cat] = (catCounts[j._cat] || 0) + 1; });
  const companies  = new Set(jobs.map(j => j.company_name || j.company || "").filter(Boolean));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#07090f;--s1:#0d1117;--s2:#141b26;--border:#1c2535;--text:#e2e8f0;--muted:#4a5568;--muted2:#718096;--accent:#00d4ff}
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif}
        .app{display:grid;grid-template-rows:64px 1fr;height:100vh}
        .hdr{background:var(--s1);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:50}
        .logo{font-family:'Syne',sans-serif;font-weight:800;font-size:17px;letter-spacing:-0.5px;color:var(--text)}
        .logo em{color:var(--accent);font-style:normal}
        .stats{display:flex;gap:20px}
        .stat{text-align:right}
        .stat-n{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:var(--accent)}
        .stat-l{font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:.8px}
        .body{display:grid;grid-template-columns:300px 1fr;overflow:hidden;height:calc(100vh - 64px)}
        .side{background:var(--s1);border-right:1px solid var(--border);overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:20px}
        .side::-webkit-scrollbar{width:4px}.side::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
        .sec-title{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted2);margin-bottom:10px}
        label{font-size:11px;color:var(--muted2);display:block;margin-bottom:5px}
        input{width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:6px;font-size:12px;font-family:monospace;outline:none;transition:border-color .15s;margin-bottom:8px}
        input:focus{border-color:var(--accent)}
        input::placeholder{color:var(--muted);font-size:11px}
        .hint{font-size:10px;color:var(--muted2);line-height:1.5;margin-top:-4px;margin-bottom:8px}
        .hint a{color:var(--accent)}
        .btn{width:100%;padding:10px;background:var(--accent);color:#000;border:none;border-radius:6px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;letter-spacing:.2px}
        .btn:hover:not(:disabled){background:#00bfdf;transform:translateY(-1px)}
        .btn:disabled{opacity:.45;cursor:not-allowed}
        .btn.loading{background:var(--s2);color:var(--accent);border:1px solid var(--accent)}
        .prog{height:3px;background:var(--s2);border-radius:2px;overflow:hidden;margin-top:8px}
        .prog-fill{height:100%;background:var(--accent);border-radius:2px;transition:width .4s}
        .log{background:var(--s2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-family:monospace;font-size:10px;color:var(--muted2);max-height:130px;overflow-y:auto;line-height:1.8}
        .log::-webkit-scrollbar{width:3px}
        .cat-list{display:flex;flex-direction:column;gap:4px}
        .cat-btn{display:flex;align-items:center;justify-content:space-between;background:none;border:1px solid var(--border);color:var(--muted2);padding:7px 10px;border-radius:6px;font-size:12px;cursor:pointer;transition:all .15s;text-align:left;width:100%}
        .cat-btn:hover{border-color:var(--accent);color:var(--text)}
        .cat-btn.active{background:rgba(0,212,255,.08);border-color:var(--accent);color:var(--accent)}
        .cat-pill{font-family:monospace;font-size:10px;background:var(--s2);padding:1px 6px;border-radius:8px}
        .cat-btn.active .cat-pill{background:rgba(0,212,255,.15)}
        .dot{width:7px;height:7px;border-radius:50%;margin-right:7px;flex-shrink:0;display:inline-block}
        .main{overflow-y:auto;padding:24px 28px}
        .main::-webkit-scrollbar{width:5px}.main::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
        .topbar{display:flex;gap:10px;margin-bottom:24px}
        .search{flex:1;background:var(--s1);border:1px solid var(--border);color:var(--text);padding:9px 14px;border-radius:8px;font-size:13px;outline:none;transition:border-color .15s;font-family:'DM Sans',sans-serif;margin-bottom:0}
        .search:focus{border-color:var(--accent)}
        .sort{background:var(--s1);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:8px;font-size:12px;font-family:monospace;outline:none;cursor:pointer}
        .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;color:var(--muted2);text-align:center}
        .empty-ico{font-size:44px;opacity:.25;margin-bottom:16px}
        .empty h3{font-family:'Syne',sans-serif;font-size:15px;color:var(--text);margin-bottom:6px}
        .empty p{font-size:12px;max-width:320px;line-height:1.6}
        .cat-sec{margin-bottom:36px;animation:fadeUp .3s ease}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .cat-hdr{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)}
        .cat-name{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--text)}
        .cat-count{font-family:monospace;font-size:10px;color:var(--muted2);background:var(--s2);padding:2px 7px;border-radius:8px}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
        .card{background:var(--s1);border:1px solid var(--border);border-radius:10px;padding:16px 18px;text-decoration:none;display:block;transition:all .2s;position:relative;overflow:hidden;cursor:pointer}
        .card::after{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--lc,#1c2535);opacity:.4;transition:opacity .2s}
        .card:hover{border-color:rgba(255,255,255,.1);transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.4)}
        .card:hover::after{opacity:1}
        .card-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:5px;line-height:1.3}
        .card-co{font-size:12px;color:var(--muted2);margin-bottom:10px}
        .card-meta{display:flex;flex-wrap:wrap;gap:5px}
        .tag{font-family:monospace;font-size:10px;padding:2px 7px;border-radius:4px;background:var(--s2);color:var(--muted2);border:1px solid var(--border)}
        .tag.remote{color:#10b981;border-color:rgba(16,185,129,.25);background:rgba(16,185,129,.05)}
        .tag.hybrid{color:#f59e0b;border-color:rgba(245,158,11,.25);background:rgba(245,158,11,.05)}
        .tag.salary{color:#ec4899;border-color:rgba(236,72,153,.25);background:rgba(236,72,153,.05)}
        .arrow{position:absolute;right:14px;top:14px;color:var(--accent);opacity:0;transition:all .2s;font-size:14px}
        .card:hover .arrow{opacity:1;transform:translate(2px,-2px)}
      `}</style>

      <div className="app">
        <header className="hdr">
          <div className="logo">IT<em>/</em>jobs</div>
          <div className="stats">
            <div className="stat"><div className="stat-n">{jobs.length}</div><div className="stat-l">Oglasa</div></div>
            <div className="stat"><div className="stat-n">{Object.keys(catCounts).length}</div><div className="stat-l">Kategorija</div></div>
            <div className="stat"><div className="stat-n">{companies.size}</div><div className="stat-l">Kompanija</div></div>
          </div>
        </header>

        <div className="body">
          <aside className="side">
            <div>
              <div className="sec-title">⚙ Apify Config</div>
              <label>API Token</label>
              <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="apify_api_xxxxxxxxxxxx" />
              <label>LinkedIn Jobs URL</label>
              <input type="text" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/jobs/search/..." />
              <div className="hint">
                Idi na <a href="https://linkedin.com/jobs/search/" target="_blank">LinkedIn Jobs</a>, postavi filtere, kopiraj URL iz address bara.
              </div>
              <label>Max rezultata</label>
              <input type="number" value={maxResults} onChange={e => setMaxResults(e.target.value)} style={{marginBottom:8}} />
              <button className={`btn${loading ? " loading" : ""}`} onClick={startScrape} disabled={loading}>
                {loading ? "⟳ Scraping..." : "▶ Pokreni scrape"}
              </button>
              {progress > 0 && <div className="prog"><div className="prog-fill" style={{width: progress + "%"}} /></div>}
            </div>

            <div>
              <div className="sec-title">📡 Status</div>
              <div className="log" ref={el => el && (el.scrollTop = el.scrollHeight)}>
                {logs.map((l, i) => (
                  <div key={i} style={{color: l.type==="ok"?"#10b981":l.type==="err"?"#ef4444":l.type==="info"?"#00d4ff":"#4a5568"}}>
                    {l.text}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="sec-title">🗂 Kategorije</div>
              <div className="cat-list">
                <button className={`cat-btn${activeCat==="all"?" active":""}`} onClick={() => setActiveCat("all")}>
                  <span>Sve kategorije</span>
                  <span className="cat-pill">{jobs.length}</span>
                </button>
                {Object.entries(catCounts).sort((a,b) => b[1]-a[1]).map(([cat, count]) => (
                  <button key={cat} className={`cat-btn${activeCat===cat?" active":""}`} onClick={() => setActiveCat(cat)}>
                    <span style={{display:"flex",alignItems:"center"}}>
                      <span className="dot" style={{background: CATEGORIES[cat]?.color || "#4a5568"}} />
                      {cat}
                    </span>
                    <span className="cat-pill">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="main">
            <div className="topbar">
              <input className="search" type="text" placeholder="🔍  Pretraži oglase..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="sort" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="date">Najnoviji</option>
                <option value="company">Kompanija A-Z</option>
                <option value="title">Naziv A-Z</option>
              </select>
            </div>

            {jobs.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">💼</div>
                <h3>Nema oglasa još</h3>
                <p>Unesi Apify token i LinkedIn URL, pa klikni "Pokreni scrape".</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">🔍</div>
                <h3>Nema rezultata</h3>
                <p>Pokušaj sa drugačijim filterom ili pretragom.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([cat, catJobs]) => (
                <div className="cat-sec" key={cat}>
                  <div className="cat-hdr">
                    <span className="dot" style={{width:9,height:9,borderRadius:"50%",background:CATEGORIES[cat]?.color||"#4a5568",display:"inline-block"}} />
                    <span className="cat-name">{cat}</span>
                    <span className="cat-count">{catJobs.length} oglasa</span>
                  </div>
                  <div className="grid">
                    {catJobs.map((job, i) => {
                      const title   = job.job_title || job.title || "Nepoznata pozicija";
                      const company = job.company_name || job.company || "";
                      const loc     = job.location || "";
                      const url     = job.URL || job.url || job.jobUrl || "#";
                      const color   = CATEGORIES[cat]?.color || "#4a5568";
                      return (
                        <a key={i} className="card" href={url} target="_blank" rel="noopener" style={{"--lc": color}}>
                          <span className="arrow">↗</span>
                          <div className="card-title">{title}</div>
                          <div className="card-co">{company && `🏢 ${company}`}{loc && ` · 📍 ${loc}`}</div>
                          <div className="card-meta">
                            <span className={`tag ${job._work}`}>
                              {job._work==="remote"?"🌐 Remote":job._work==="hybrid"?"🔄 Hybrid":"🏢 Onsite"}
                            </span>
                            {job._date && <span className="tag">{job._date}</span>}
                            {job.salary && <span className="tag salary">💰 {job.salary}</span>}
                            {(job.job_type||job.employment_type) && <span className="tag">{job.job_type||job.employment_type}</span>}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </main>
        </div>
      </div>
    </>
  );
}
