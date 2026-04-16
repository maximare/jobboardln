"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── KP Brand ──────────────────────────────────────────────────────────────────
const KP = {
  blue:       "#003DA5",
  blueDark:   "#002A7A",
  blueLight:  "#E8EEFA",
  red:        "#E8000F",
  yellow:     "#FFD600",
  green:      "#00A651",
  orange:     "#FF6B00",
  bg:         "#F4F6FB",
  surface:    "#FFFFFF",
  border:     "#DDE3F0",
  borderDark: "#B8C4DE",
  text:       "#0D1A3A",
  textSub:    "#4A5A7A",
  textMuted:  "#8A9ABE",
};

const PROJECT_GID = "1214029052973037";
const PROXY = "/api/asana";

const EFFORT_LABEL = { 1: "Mali", 2: "Srednji", 3: "Veliki" };
const EFFORT_R     = { 1: 10, 2: 17, 3: 26 };
const SECTION_Y    = { "Visok prioritet": 4, "Srednji prioritet": 3, "Nice to have": 2, "Implementacija": 1 };

const TIP_COLOR = {
  "Kupci":                    KP.blue,
  "Prodavci - profesionalni": KP.red,
  "Prodavci - fizicka lica":  KP.green,
  "Kupci i Prodavci":         KP.orange,
};
const TIP_BG = {
  "Kupci":                    "rgba(0,61,165,0.12)",
  "Prodavci - profesionalni": "rgba(232,0,15,0.12)",
  "Prodavci - fizicka lica":  "rgba(0,166,81,0.12)",
  "Kupci i Prodavci":         "rgba(255,107,0,0.12)",
};

const VIEWS = [
  { id: "bubble",  label: "Bubble" },
  { id: "matrix",  label: "2×2 Matrica" },
  { id: "bar",     label: "Bar Chart" },
  { id: "scatter", label: "Swim Lanes" },
  { id: "table",   label: "Tabela" },
];

// ── API ────────────────────────────────────────────────────────────────────────
async function asanaFetch(path, token) {
  const res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`, {
    headers: { "x-asana-token": token },
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "Asana greška");
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data;
}

function parseTask(t) {
  const effortField = t.custom_fields?.find(f => f.name === "Trajanje");
  const tipField    = t.custom_fields?.find(f => f.name === "Tip korisnika");
  const effortName  = effortField?.enum_value?.name || "";
  const effort      = effortName.includes("Mali") ? 1 : effortName.includes("Veliki") ? 3 : 2;
  const tip         = tipField?.enum_value?.name || "Kupci";
  const section     = t.memberships?.[0]?.section?.name || "Ostalo";
  return { name: t.name, effort, tip, section, completed: t.completed };
}

// ── KP Logo SVG ───────────────────────────────────────────────────────────────
function KPLogo({ height = 36 }) {
  return (
    <img src="/kp-logo.png" alt="KupujemProdajem" style={{ height, display: "block", objectFit: "contain" }} />
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ content, x, y, visible }) {
  if (!visible || !content) return null;
  return (
    <div style={{
      position: "fixed", left: x + 14, top: y - 12,
      background: KP.surface, border: `1px solid ${KP.borderDark}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
      pointerEvents: "none", maxWidth: 280, zIndex: 9999,
      boxShadow: "0 4px 20px rgba(0,61,165,0.12)",
      color: KP.text, lineHeight: 1.6,
    }} dangerouslySetInnerHTML={{ __html: content }} />
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function TipLegend({ filter, setFilter }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: KP.textMuted, letterSpacing: ".06em", textTransform: "uppercase", marginRight: 4 }}>Segment:</span>
      {["all", ...Object.keys(TIP_COLOR)].map(f => {
        const active = (filter || "all") === f;
        const label  = f === "all" ? "Svi" : f === "Prodavci - profesionalni" ? "Prodavci prof." : f === "Prodavci - fizicka lica" ? "Prodavci fiz." : f;
        return (
          <button key={f} onClick={() => setFilter && setFilter(f)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: setFilter ? "pointer" : "default",
            border: active ? `1.5px solid ${f === "all" ? KP.blue : TIP_COLOR[f]}` : `1px solid ${KP.border}`,
            background: active ? (f === "all" ? KP.blueLight : TIP_BG[f] || KP.blueLight) : KP.surface,
            color: active ? (f === "all" ? KP.blue : TIP_COLOR[f]) : KP.textSub,
            fontWeight: active ? 700 : 400,
            transition: "all .15s",
          }}>
            {f !== "all" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: TIP_COLOR[f], flexShrink: 0 }} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Section Badge ─────────────────────────────────────────────────────────────
function SectionBadge({ section }) {
  const map = {
    "Visok prioritet":   { bg: "#FFF0F1", color: KP.red,    border: "#FFBFC2" },
    "Srednji prioritet": { bg: "#FFF8E0", color: "#8B6200",  border: "#FFE580" },
    "Nice to have":      { bg: "#E8EEFA", color: KP.blue,   border: "#B8C4DE" },
    "Implementacija":    { bg: "#E8F7EF", color: KP.green,  border: "#A3DFC0" },
    "Završeno":          { bg: "#F0F0F0", color: "#666",     border: "#CCC"    },
  };
  const s = map[section] || map["Nice to have"];
  return (
    <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: ".04em" }}>
      {section}
    </span>
  );
}

// ── BUBBLE VIEW ───────────────────────────────────────────────────────────────
function BubbleView({ tasks }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const [tt, setTt] = useState({ visible: false, content: "", x: 0, y: 0 });
  const [filter, setFilter] = useState("all");

  const jitter = (val, idx, spread) => val + (((idx * 2.399) % 1) - 0.5) * spread;

  const buildDatasets = useCallback((f) => {
    const grouped = {};
    tasks.forEach((t, i) => {
      if (f !== "all" && t.tip !== f) return;
      if (!grouped[t.tip]) grouped[t.tip] = [];
      grouped[t.tip].push({
        x: jitter(t.effort, i, 0.45),
        y: jitter(SECTION_Y[t.section] ?? 1, i + 7, 0.38),
        r: EFFORT_R[t.effort] || 14,
        _name: t.name, _tip: t.tip, _section: t.section, _effort: EFFORT_LABEL[t.effort],
      });
    });
    return Object.entries(grouped).map(([tip, data]) => ({
      label: tip, data,
      backgroundColor: TIP_BG[tip] || "rgba(100,100,100,0.12)",
      borderColor: TIP_COLOR[tip] || "#888",
      borderWidth: 2,
    }));
  }, [tasks]);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new window.Chart(canvasRef.current, {
      type: "bubble",
      data: { datasets: buildDatasets(filter) },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 20, right: 20, bottom: 10, left: 10 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: {
            min: 0.2, max: 3.8,
            ticks: { color: KP.textMuted, font: { size: 12, family: "'PT Sans', sans-serif", weight: "bold" }, callback: v => ({ 1: "Mali", 2: "Srednji", 3: "Veliki" }[Math.round(v)] || ""), stepSize: 1 },
            grid: { color: "rgba(0,61,165,0.06)" },
            title: { display: true, text: "Effort (trajanje)", color: KP.textSub, font: { size: 12 } },
          },
          y: {
            min: 0.2, max: 4.8,
            ticks: { color: KP.textMuted, font: { size: 12, family: "'PT Sans', sans-serif", weight: "bold" }, callback: v => ({ 1: "Implementacija", 2: "Nice to have", 3: "Srednji prioritet", 4: "Visok prioritet" }[Math.round(v)] || ""), stepSize: 1 },
            grid: { color: "rgba(0,61,165,0.06)" },
          },
        },
        onHover(e, els) { canvasRef.current.style.cursor = els.length ? "pointer" : "default"; },
      },
    });
    const canvas = canvasRef.current;
    const onMove = (e) => {
      if (!chartRef.current) return;
      const pts = chartRef.current.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
      if (!pts.length) { setTt(t => ({ ...t, visible: false })); return; }
      const d = chartRef.current.data.datasets[pts[0].datasetIndex].data[pts[0].index];
      setTt({ visible: true, x: e.clientX, y: e.clientY,
        content: `<strong style="color:${KP.text};font-size:13px">${d._name}</strong><br>
          <span style="color:${KP.textSub};font-size:11px">${d._section}</span><br><br>
          <span style="color:${KP.textMuted}">Effort:</span> <b>${d._effort}</b><br>
          <span style="color:${KP.textMuted}">Korisnici:</span> <b style="color:${TIP_COLOR[d._tip]}">${d._tip}</b>` });
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", () => setTt(t => ({ ...t, visible: false })));
    return () => { canvas.removeEventListener("mousemove", onMove); };
  }, [tasks, filter, buildDatasets]);

  useEffect(() => {
    if (chartRef.current) { chartRef.current.data.datasets = buildDatasets(filter); chartRef.current.update(); }
  }, [filter, buildDatasets]);

  return (
    <div>
      <TipLegend filter={filter} setFilter={setFilter} />
      <Tooltip {...tt} />
      <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        {[{r:10,l:"Mali effort"},{r:17,l:"Srednji effort"},{r:26,l:"Veliki effort"}].map(({r,l}) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: KP.textMuted }}>
            <div style={{ width: r*1.4, height: r*1.4, borderRadius: "50%", background: "rgba(0,61,165,0.12)", border: `1.5px solid ${KP.blue}`, flexShrink: 0 }} />
            {l}
          </div>
        ))}
      </div>
      <div style={{ position: "relative", width: "100%", height: 460 }}>
        <canvas ref={canvasRef} role="img" aria-label="Bubble chart KP Auto projekata" />
      </div>
    </div>
  );
}

// ── 2×2 MATRICA ───────────────────────────────────────────────────────────────
function MatrixView({ tasks }) {
  const [tt, setTt] = useState({ visible: false, content: "", x: 0, y: 0 });
  const assign = (t) => {
    const hi = t.section === "Visok prioritet";
    const lo = t.effort <= 1;
    if (hi && lo) return "q1";
    if (hi && !lo) return "q2";
    if (!hi && lo) return "q3";
    return "q4";
  };
  const QUADRANTS = [
    { id: "q1", label: "Uradi odmah", sub: "Visok prioritet · Mali effort", accent: KP.green,  bg: "#E8F7EF", col: 0, row: 0 },
    { id: "q2", label: "Zaplanirati",  sub: "Visok prioritet · Veći effort", accent: KP.blue,   bg: KP.blueLight, col: 1, row: 0 },
    { id: "q3", label: "Brzo ubrati",  sub: "Niži prioritet · Mali effort",  accent: KP.orange, bg: "#FFF4EC", col: 0, row: 1 },
    { id: "q4", label: "Razmisliti",   sub: "Niži prioritet · Veći effort",  accent: KP.red,    bg: "#FFF0F1", col: 1, row: 1 },
  ];
  const byQ = Object.fromEntries(QUADRANTS.map(q => [q.id, []]));
  tasks.forEach(t => { const q = assign(t); if (byQ[q]) byQ[q].push(t); });

  return (
    <div>
      <TipLegend />
      <Tooltip {...tt} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {QUADRANTS.map(q => (
          <div key={q.id} style={{
            background: q.bg, border: `1.5px solid ${q.accent}33`,
            borderTop: `3px solid ${q.accent}`,
            borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: q.accent, letterSpacing: "-.01em" }}>{q.label}</div>
              <div style={{ fontSize: 11, color: KP.textMuted, marginTop: 3 }}>{q.sub}</div>
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: q.accent }}>{byQ[q.id].length} projekata</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {byQ[q.id].length === 0 && <span style={{ fontSize: 12, color: KP.textMuted }}>—</span>}
              {byQ[q.id].map((t, i) => (
                <div key={i}
                  onMouseEnter={e => setTt({ visible: true, x: e.clientX, y: e.clientY,
                    content: `<strong style="color:${KP.text}">${t.name}</strong><br>
                      <span style="color:${KP.textSub};font-size:11px">${t.section}</span><br><br>
                      <span style="color:${KP.textMuted}">Effort:</span> <b>${EFFORT_LABEL[t.effort]}</b><br>
                      <span style="color:${KP.textMuted}">Korisnici:</span> <b style="color:${TIP_COLOR[t.tip]}">${t.tip}</b>` })}
                  onMouseLeave={() => setTt(t => ({ ...t, visible: false }))}
                  style={{ display: "flex", alignItems: "flex-start", gap: 7, cursor: "default",
                    padding: "6px 8px", borderRadius: 6,
                    background: "rgba(255,255,255,0.7)", border: `0.5px solid ${q.accent}22` }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: TIP_COLOR[t.tip] || "#888", flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: 12, color: KP.text, lineHeight: 1.45 }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BAR VIEW ──────────────────────────────────────────────────────────────────
function BarView({ tasks }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const [tt, setTt] = useState({ visible: false, content: "", x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const ORDER = ["Visok prioritet", "Srednji prioritet", "Nice to have", "Implementacija"];
    const sorted = [...tasks].sort((a, b) => {
      const si = ORDER.indexOf(a.section) - ORDER.indexOf(b.section);
      return si !== 0 ? si : b.effort - a.effort;
    });
    chartRef.current = new window.Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: sorted.map(t => t.name.length > 40 ? t.name.slice(0, 38) + "…" : t.name),
        datasets: [{
          label: "Effort",
          data: sorted.map(t => t.effort),
          backgroundColor: sorted.map(t => TIP_BG[t.tip] || "rgba(100,100,100,0.12)"),
          borderColor: sorted.map(t => TIP_COLOR[t.tip] || "#888"),
          borderWidth: 2, borderSkipped: false, borderRadius: 4,
        }],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 16 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { min: 0, max: 3.5,
            ticks: { color: KP.textMuted, font: { size: 11, weight: "bold" }, callback: v => ({ 1: "Mali", 2: "Srednji", 3: "Veliki" }[v] || "") },
            grid: { color: "rgba(0,61,165,0.06)" } },
          y: { ticks: { color: KP.text, font: { size: 11 } }, grid: { display: false } },
        },
        onHover(e, els) { canvasRef.current.style.cursor = els.length ? "pointer" : "default"; },
      },
    });
    const canvas = canvasRef.current;
    const onMove = (e) => {
      if (!chartRef.current) return;
      const pts = chartRef.current.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
      if (!pts.length) { setTt(t => ({ ...t, visible: false })); return; }
      const t = sorted[pts[0].index];
      setTt({ visible: true, x: e.clientX, y: e.clientY,
        content: `<strong style="color:${KP.text}">${t.name}</strong><br>
          <span style="color:${KP.textSub};font-size:11px">${t.section}</span><br><br>
          <span style="color:${KP.textMuted}">Effort:</span> <b>${EFFORT_LABEL[t.effort]}</b><br>
          <span style="color:${KP.textMuted}">Korisnici:</span> <b style="color:${TIP_COLOR[t.tip]}">${t.tip}</b>` });
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", () => setTt(t => ({ ...t, visible: false })));
    return () => canvas.removeEventListener("mousemove", onMove);
  }, [tasks]);

  return (
    <div>
      <TipLegend />
      <Tooltip {...tt} />
      <div style={{ position: "relative", width: "100%", height: Math.max(400, tasks.length * 29 + 60) }}>
        <canvas ref={canvasRef} role="img" aria-label="Horizontal bar chart KP Auto projekata" />
      </div>
    </div>
  );
}

// ── SWIM LANES ────────────────────────────────────────────────────────────────
function ScatterView({ tasks }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const [tt, setTt] = useState({ visible: false, content: "", x: 0, y: 0 });
  const TIPS = Object.keys(TIP_COLOR);
  const jitter = (val, idx) => val + (((idx * 1.618) % 1) - 0.5) * 0.5;

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new window.Chart(canvasRef.current, {
      type: "bubble",
      data: {
        datasets: TIPS.map(tip => ({
          label: tip,
          data: tasks.filter(t => t.tip === tip).map((t, i) => ({
            x: jitter(t.effort, i + TIPS.indexOf(tip) * 11),
            y: TIPS.indexOf(tip) + 1,
            r: EFFORT_R[t.effort] || 14,
            _name: t.name, _tip: t.tip, _section: t.section, _effort: EFFORT_LABEL[t.effort],
          })),
          backgroundColor: TIP_BG[tip],
          borderColor: TIP_COLOR[tip],
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 16, right: 24, bottom: 10, left: 10 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { min: 0.3, max: 3.7,
            ticks: { color: KP.textMuted, font: { size: 12, weight: "bold" }, callback: v => ({ 1: "Mali", 2: "Srednji", 3: "Veliki" }[Math.round(v)] || ""), stepSize: 1 },
            grid: { color: "rgba(0,61,165,0.06)" },
            title: { display: true, text: "Effort", color: KP.textSub, font: { size: 12 } } },
          y: { min: 0.3, max: TIPS.length + 0.7,
            ticks: { color: KP.text, font: { size: 12, weight: "bold" }, callback: v => { const t = TIPS[Math.round(v) - 1]; return t === "Prodavci - profesionalni" ? "Prodavci prof." : t === "Prodavci - fizicka lica" ? "Prodavci fiz." : t || ""; }, stepSize: 1 },
            grid: { color: "rgba(0,61,165,0.06)" } },
        },
        onHover(e, els) { canvasRef.current.style.cursor = els.length ? "pointer" : "default"; },
      },
    });
    const canvas = canvasRef.current;
    const onMove = (e) => {
      if (!chartRef.current) return;
      const pts = chartRef.current.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
      if (!pts.length) { setTt(t => ({ ...t, visible: false })); return; }
      const d = chartRef.current.data.datasets[pts[0].datasetIndex].data[pts[0].index];
      setTt({ visible: true, x: e.clientX, y: e.clientY,
        content: `<strong style="color:${KP.text}">${d._name}</strong><br>
          <span style="color:${KP.textSub};font-size:11px">${d._section}</span><br><br>
          <span style="color:${KP.textMuted}">Effort:</span> <b>${d._effort}</b><br>
          <span style="color:${KP.textMuted}">Korisnici:</span> <b style="color:${TIP_COLOR[d._tip]}">${d._tip}</b>` });
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", () => setTt(t => ({ ...t, visible: false })));
    return () => canvas.removeEventListener("mousemove", onMove);
  }, [tasks]);

  return (
    <div>
      <p style={{ fontSize: 12, color: KP.textSub, marginBottom: 16, lineHeight: 1.6 }}>
        Svaki red = jedan segment korisnika. X osa = effort. Veličina = effort.
      </p>
      <Tooltip {...tt} />
      <div style={{ position: "relative", width: "100%", height: 340 }}>
        <canvas ref={canvasRef} role="img" aria-label="Scatter swim lanes" />
      </div>
    </div>
  );
}

// ── TABELA ────────────────────────────────────────────────────────────────────
function TableView({ tasks }) {
  const [sort, setSort] = useState("section");
  const ORDER = ["Visok prioritet", "Srednji prioritet", "Nice to have", "Implementacija", "Završeno"];
  const sorted = [...tasks].sort((a, b) => {
    if (sort === "section") return ORDER.indexOf(a.section) - ORDER.indexOf(b.section);
    if (sort === "effort")  return a.effort - b.effort;
    if (sort === "tip")     return a.tip.localeCompare(b.tip);
    return 0;
  });

  const Th = ({ id, label }) => (
    <th onClick={() => setSort(id)} style={{
      padding: "10px 14px", fontSize: 11, fontWeight: 700, textAlign: "left",
      color: sort === id ? KP.blue : KP.textMuted,
      borderBottom: `2px solid ${sort === id ? KP.blue : KP.border}`,
      cursor: "pointer", userSelect: "none", letterSpacing: ".05em", textTransform: "uppercase",
      background: sort === id ? KP.blueLight : "transparent",
    }}>{label}{sort === id ? " ↑" : ""}</th>
  );

  const effortStyle = (e) => ({
    padding: "3px 9px", borderRadius: 10, fontSize: 11, fontWeight: 700, display: "inline-block",
    background: e === 1 ? "#E8F7EF" : e === 2 ? "#FFF8E0" : "#FFF0F1",
    color: e === 1 ? KP.green : e === 2 ? "#7A5800" : KP.red,
    border: `1px solid ${e === 1 ? "#A3DFC0" : e === 2 ? "#FFE580" : "#FFBFC2"}`,
  });

  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${KP.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: KP.bg }}>
          <tr>
            <Th id="name"    label="Naziv projekta" />
            <Th id="section" label="Sekcija" />
            <Th id="effort"  label="Effort" />
            <Th id="tip"     label="Tip korisnika" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr key={i} style={{
              borderBottom: `1px solid ${KP.border}`,
              background: i % 2 === 0 ? KP.surface : KP.bg,
              transition: "background .1s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = KP.blueLight}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? KP.surface : KP.bg}
            >
              <td style={{ padding: "10px 14px", color: KP.text, fontWeight: 500 }}>{t.name}</td>
              <td style={{ padding: "10px 14px" }}><SectionBadge section={t.section} /></td>
              <td style={{ padding: "10px 14px" }}><span style={effortStyle(t.effort)}>{EFFORT_LABEL[t.effort]}</span></td>
              <td style={{ padding: "10px 14px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: TIP_COLOR[t.tip] || KP.textSub, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: TIP_COLOR[t.tip] || "#888", flexShrink: 0 }} />
                  {t.tip}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── TOKEN SCREEN ──────────────────────────────────────────────────────────────
function TokenScreen({ onConnect }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const connect = async () => {
    if (!token.trim()) return;
    setLoading(true); setErr("");
    try {
      await asanaFetch("/users/me?opt_fields=name", token.trim());
      onConnect(token.trim());
    } catch (e) {
      setErr("Greška: " + e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: KP.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
            <KPLogo height={52} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: KP.text, margin: "0 0 6px", letterSpacing: "-.02em" }}>
            Auto Roadmap Vizualizator
          </h1>
          <p style={{ fontSize: 13, color: KP.textSub, margin: 0 }}>Unesi Asana Personal Access Token</p>
        </div>
        <div style={{ background: KP.surface, border: `1px solid ${KP.border}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 16px rgba(0,61,165,0.08)" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: KP.textMuted, letterSpacing: ".07em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>
            Personal Access Token
          </label>
          <input type="password" value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === "Enter" && connect()}
            placeholder="1/123456789:abcdef..."
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
              border: `1.5px solid ${KP.border}`, fontSize: 13, outline: "none", marginBottom: 12,
              fontFamily: "monospace", color: KP.text,
              background: KP.bg }} />
          <button onClick={connect} disabled={!token.trim() || loading}
            style={{ width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
              background: token.trim() && !loading ? KP.blue : KP.border,
              color: token.trim() && !loading ? "#fff" : KP.textMuted,
              fontSize: 14, fontWeight: 700, cursor: token.trim() && !loading ? "pointer" : "default",
              letterSpacing: ".02em", transition: "all .2s" }}>
            {loading ? "Učitavanje..." : "Poveži se →"}
          </button>
          {err && <p style={{ marginTop: 8, color: KP.red, fontSize: 12, margin: "8px 0 0" }}>{err}</p>}
        </div>
        <div style={{ marginTop: 14, background: KP.surface, border: `1px solid ${KP.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: KP.textSub, lineHeight: 1.7 }}>
            <b style={{ color: KP.text }}>Kako doći do tokena:</b><br />
            1. <span style={{ color: KP.blue }}>app.asana.com</span> → slika profila<br />
            2. <b>My Settings → Apps → Manage Developer Apps</b><br />
            3. <b>New access token</b> → kopiraj
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function AutoPage() {
  const [token,   setToken]   = useState(null);
  const [tasks,   setTasks]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [view,    setView]    = useState("bubble");
  const [chartJs, setChartJs] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Učitaj Chart.js
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Chart) { setChartJs(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload = () => setChartJs(true);
    document.head.appendChild(s);
  }, []);

  // Vrati token iz sessionStorage pri refresh-u
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem("kp_asana_token");
    if (saved) fetchTasks(saved);
  }, []);

  const fetchTasks = async (tok) => {
    setToken(tok); setLoading(true); setError("");
    try {
      const raw = await asanaFetch(
        `/tasks?project=${PROJECT_GID}&opt_fields=name,completed,memberships.section.name,custom_fields&limit=100`, tok
      );
      setTasks(raw.filter(t => !t.completed).map(parseTask));
      setLastSync(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const onConnect = (tok) => {
    sessionStorage.setItem("kp_asana_token", tok);
    fetchTasks(tok);
  };

  const onLogout = () => {
    sessionStorage.removeItem("kp_asana_token");
    setToken(null); setTasks(null);
  };

  const onRefresh = () => {
    if (token) fetchTasks(token);
  };

  if (!token) return <TokenScreen onConnect={onConnect} />;

  const sectionCounts = tasks ? Object.entries(
    tasks.reduce((acc, t) => { acc[t.section] = (acc[t.section] || 0) + 1; return acc; }, {})
  ) : [];

  return (
    <div style={{ minHeight: "100vh", background: KP.bg, fontFamily: "'PT Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: KP.surface, borderBottom: `2px solid ${KP.blue}`, padding: "0 28px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, height: 64 }}>
          <KPLogo height={38} />
          <div style={{ width: 1, height: 32, background: KP.border }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: KP.text, letterSpacing: "-.01em" }}>Auto Roadmap</div>
            <div style={{ fontSize: 11, color: KP.textSub }}>Vizualizator projekta</div>
          </div>

          {/* Section pills */}
          {tasks && (
            <div style={{ display: "flex", gap: 6, marginLeft: 16, flexWrap: "wrap" }}>
              {sectionCounts.map(([sec, cnt]) => (
                <SectionBadge key={sec} section={sec} />
              ))}
            </div>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {lastSync && (
              <span style={{ fontSize: 11, color: KP.textMuted }}>
                Sinhronizovano {lastSync.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {tasks && <span style={{ fontSize: 12, color: KP.textSub }}>{tasks.length} projekata</span>}
            <button onClick={onRefresh} disabled={loading}
              style={{ padding: "5px 12px", fontSize: 11, borderRadius: 6,
                border: `1.5px solid ${KP.blue}`, background: KP.blueLight,
                color: KP.blue, cursor: loading ? "default" : "pointer", fontWeight: 700 }}>
              {loading ? "..." : "↻ Osveži"}
            </button>
            <button onClick={onLogout}
              style={{ padding: "5px 12px", fontSize: 11, borderRadius: 6,
                border: `1px solid ${KP.border}`, background: KP.bg,
                color: KP.textSub, cursor: "pointer" }}>
              Odjava
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", gap: 0 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              padding: "12px 18px", fontSize: 13, fontWeight: view === v.id ? 700 : 400,
              color: view === v.id ? KP.blue : KP.textSub,
              background: "transparent", border: "none", cursor: "pointer",
              borderBottom: `3px solid ${view === v.id ? KP.blue : "transparent"}`,
              transition: "all .15s", letterSpacing: "-.01em",
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 28px 48px" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "48px 0", color: KP.textSub, fontSize: 13 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%",
              border: `2px solid ${KP.border}`, borderTopColor: KP.blue,
              animation: "spin .7s linear infinite" }} />
            Učitavam projekte iz Asane...
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {error && (
          <div style={{ padding: "12px 16px", background: "#FFF0F1", border: `1px solid ${KP.red}44`,
            borderRadius: 8, color: KP.red, fontSize: 13, marginBottom: 20 }}>⚠️ {error}</div>
        )}
        {tasks && !loading && (
          <>
            {(!chartJs && ["bubble","bar","scatter"].includes(view)) ? (
              <div style={{ color: KP.textSub, fontSize: 13 }}>Učitavanje Chart.js...</div>
            ) : (
              <>
                {view === "bubble"  && <BubbleView  tasks={tasks} />}
                {view === "matrix"  && <MatrixView  tasks={tasks} />}
                {view === "bar"     && <BarView     tasks={tasks} />}
                {view === "scatter" && <ScatterView tasks={tasks} />}
                {view === "table"   && <TableView   tasks={tasks} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
