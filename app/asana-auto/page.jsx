"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Konstante ─────────────────────────────────────────────────────────────────
const PROJECT_GID = "1214029052973037";
const PROXY = "/api/asana";

const EFFORT_LABEL = { 1: "Mali", 2: "Srednji", 3: "Veliki" };
const EFFORT_R = { 1: 10, 2: 17, 3: 26 };
const SECTION_Y = { "Visok prioritet": 4, "Srednji prioritet": 3, "Nice to have": 2, "Implementacija": 1, "Završeno": 0 };

const TIP_COLOR = {
  "Kupci": "#378ADD",
  "Prodavci - profesionalni": "#D4537E",
  "Prodavci - fizicka lica": "#534AB7",
  "Kupci i Prodavci": "#1D9E75",
};
const TIP_BG = {
  "Kupci": "rgba(55,138,221,0.15)",
  "Prodavci - profesionalni": "rgba(212,83,126,0.15)",
  "Prodavci - fizicka lica": "rgba(83,74,183,0.15)",
  "Kupci i Prodavci": "rgba(29,158,117,0.15)",
};

const VIEWS = [
  { id: "bubble",   label: "Bubble Chart" },
  { id: "matrix",   label: "2×2 Matrica" },
  { id: "bar",      label: "Bar Chart" },
  { id: "scatter",  label: "Swim Lanes" },
  { id: "table",    label: "Tabela" },
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
  const effort      = effortName.includes("Mali") ? 1 : effortName.includes("Srednji") ? 2 : effortName.includes("Veliki") ? 3 : 2;
  const tip         = tipField?.enum_value?.name || "Kupci";
  const section     = t.memberships?.[0]?.section?.name || "Ostalo";
  return { name: t.name, effort, tip, section, completed: t.completed };
}

// ── TokenScreen ───────────────────────────────────────────────────────────────
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🚗</div>
          <h1 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 6px" }}>KP Auto — Vizualizator projekta</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Unesi Asana Personal Access Token</p>
        </div>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Token</label>
          <input type="password" value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === "Enter" && connect()}
            placeholder="1/123456789:abcdef..."
            style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
          <button onClick={connect} disabled={!token.trim() || loading}
            style={{ width: "100%", padding: "9px 0" }}>
            {loading ? "Učitavanje..." : "Poveži se →"}
          </button>
          {err && <p style={{ marginTop: 8, color: "var(--color-text-danger)", fontSize: 12 }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Tooltip hook ───────────────────────────────────────────────────────────────
function Tooltip({ content, x, y, visible }) {
  if (!visible || !content) return null;
  return (
    <div style={{
      position: "fixed", left: x + 12, top: y - 10,
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-secondary)",
      borderRadius: "var(--border-radius-md)",
      padding: "10px 14px", fontSize: 12, pointerEvents: "none",
      maxWidth: 260, zIndex: 1000, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }} dangerouslySetInnerHTML={{ __html: content }} />
  );
}

// ── Legenda ───────────────────────────────────────────────────────────────────
function TipLegend() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
      {Object.entries(TIP_COLOR).map(([tip, color]) => (
        <div key={tip} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
          {tip}
        </div>
      ))}
    </div>
  );
}

// ── BUBBLE CHART ──────────────────────────────────────────────────────────────
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
      backgroundColor: TIP_BG[tip] || "rgba(100,100,100,0.15)",
      borderColor: TIP_COLOR[tip] || "#888",
      borderWidth: 1.5,
    }));
  }, [tasks]);

  useEffect(() => {
    if (!canvasRef.current || typeof window === "undefined") return;
    const Chart = window.Chart;
    if (!Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const gridColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
    const labelColor = isDark ? "#999" : "#888";
    chartRef.current = new Chart(canvasRef.current, {
      type: "bubble",
      data: { datasets: buildDatasets(filter) },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 20, right: 20, bottom: 10, left: 10 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: {
            min: 0.2, max: 3.8,
            ticks: { color: labelColor, font: { size: 12 }, callback: v => ({ 1: "Mali", 2: "Srednji", 3: "Veliki" }[Math.round(v)] || ""), stepSize: 1 },
            grid: { color: gridColor },
            title: { display: true, text: "Effort", color: labelColor, font: { size: 12 } },
          },
          y: {
            min: 0.2, max: 4.8,
            ticks: { color: labelColor, font: { size: 12 }, callback: v => ({ 1: "Implementacija", 2: "Nice to have", 3: "Srednji prioritet", 4: "Visok prioritet" }[Math.round(v)] || ""), stepSize: 1 },
            grid: { color: gridColor },
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
        content: `<strong style="color:var(--color-text-primary)">${d._name}</strong><br><span style="color:var(--color-text-secondary);font-size:11px">${d._section}</span><br><br>
          <span style="color:var(--color-text-secondary)">Effort:</span> ${d._effort}<br>
          <span style="color:var(--color-text-secondary)">Korisnici:</span> ${d._tip}` });
    };
    const onLeave = () => setTt(t => ({ ...t, visible: false }));
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    return () => { canvas.removeEventListener("mousemove", onMove); canvas.removeEventListener("mouseleave", onLeave); };
  }, [tasks, filter, buildDatasets]);

  useEffect(() => {
    if (chartRef.current) { chartRef.current.data.datasets = buildDatasets(filter); chartRef.current.update(); }
  }, [filter, buildDatasets]);

  return (
    <div>
      <TipLegend />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {["all", ...Object.keys(TIP_COLOR)].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              background: filter === f ? "var(--color-background-primary)" : "var(--color-background-secondary)",
              color: filter === f ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              border: `0.5px solid ${filter === f ? "var(--color-border-primary)" : "var(--color-border-tertiary)"}`,
              fontWeight: filter === f ? 500 : 400 }}>
            {f === "all" ? "Svi" : f === "Prodavci - profesionalni" ? "Prodavci prof." : f === "Prodavci - fizicka lica" ? "Prodavci fiz." : f}
          </button>
        ))}
      </div>
      <Tooltip {...tt} />
      <div style={{ position: "relative", width: "100%", height: 460 }}>
        <canvas ref={canvasRef} role="img" aria-label="Bubble chart KP Auto projekata" />
      </div>
    </div>
  );
}

// ── 2×2 MATRICA ───────────────────────────────────────────────────────────────
function MatrixView({ tasks }) {
  const [tt, setTt] = useState({ visible: false, content: "", x: 0, y: 0 });
  const QUADRANTS = [
    { id: "q1", label: "Uradi odmah", sub: "Visok prioritet · Mali effort", effortMax: 1, sections: ["Visok prioritet"], col: 0, row: 0, accent: "#1D9E75" },
    { id: "q2", label: "Zaplanirati", sub: "Visok prioritet · Veliki effort", effortMin: 2, sections: ["Visok prioritet"], col: 1, row: 0, accent: "#378ADD" },
    { id: "q3", label: "Brzo ubrati", sub: "Nizak prioritet · Mali effort", effortMax: 1, sections: ["Srednji prioritet", "Nice to have", "Implementacija"], col: 0, row: 1, accent: "#D4537E" },
    { id: "q4", label: "Razmisliti", sub: "Nizak prioritet · Veliki effort", effortMin: 2, sections: ["Srednji prioritet", "Nice to have", "Implementacija"], col: 1, row: 1, accent: "#888" },
  ];

  const assign = (t) => {
    const highPri = ["Visok prioritet"].includes(t.section);
    const lowEff  = t.effort <= 1;
    if (highPri && lowEff) return "q1";
    if (highPri && !lowEff) return "q2";
    if (!highPri && lowEff) return "q3";
    return "q4";
  };

  const byQ = {};
  QUADRANTS.forEach(q => { byQ[q.id] = []; });
  tasks.forEach(t => { const q = assign(t); if (byQ[q]) byQ[q].push(t); });

  return (
    <div>
      <TipLegend />
      <Tooltip {...tt} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {QUADRANTS.map(q => (
          <div key={q.id} style={{
            background: "var(--color-background-primary)",
            border: `0.5px solid var(--color-border-tertiary)`,
            borderTop: `2px solid ${q.accent}`,
            borderRadius: "var(--border-radius-lg)", padding: "14px 16px",
          }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: q.accent }}>{q.label}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{q.sub}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {byQ[q.id].length === 0 && <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>—</span>}
              {byQ[q.id].map((t, i) => (
                <div key={i}
                  onMouseEnter={e => setTt({ visible: true, x: e.clientX, y: e.clientY,
                    content: `<strong style="color:var(--color-text-primary)">${t.name}</strong><br><span style="color:var(--color-text-secondary);font-size:11px">${t.section}</span><br><br>
                      <span style="color:var(--color-text-secondary)">Effort:</span> ${EFFORT_LABEL[t.effort]}<br>
                      <span style="color:var(--color-text-secondary)">Korisnici:</span> ${t.tip}` })}
                  onMouseLeave={() => setTt(t => ({ ...t, visible: false }))}
                  style={{ display: "flex", alignItems: "center", gap: 7, cursor: "default", padding: "4px 6px",
                    borderRadius: 5, background: "var(--color-background-secondary)" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: TIP_COLOR[t.tip] || "#888", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--color-text-primary)", lineHeight: 1.4 }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
          X osa: Effort (Mali = levo, Veliki = desno) &nbsp;·&nbsp; Y osa: Prioritet (Visok = gore, Nizak = dole)
        </div>
      </div>
    </div>
  );
}

// ── HORIZONTAL BAR ────────────────────────────────────────────────────────────
function BarView({ tasks }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const [tt, setTt] = useState({ visible: false, content: "", x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current || typeof window === "undefined") return;
    const Chart = window.Chart;
    if (!Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const SECTION_ORDER = ["Visok prioritet", "Srednji prioritet", "Nice to have", "Implementacija"];
    const sorted = [...tasks].sort((a, b) => {
      const si = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
      return si !== 0 ? si : a.effort - b.effort;
    });

    const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const labelColor = isDark ? "#bbb" : "#555";

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: sorted.map(t => t.name.length > 36 ? t.name.slice(0, 34) + "…" : t.name),
        datasets: [
          {
            label: "Effort",
            data: sorted.map(t => t.effort),
            backgroundColor: sorted.map(t => TIP_BG[t.tip] || "rgba(100,100,100,0.15)"),
            borderColor: sorted.map(t => TIP_COLOR[t.tip] || "#888"),
            borderWidth: 1.5,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 16 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: {
            min: 0, max: 3.5,
            ticks: { color: labelColor, font: { size: 11 }, callback: v => ({ 1: "Mali", 2: "Srednji", 3: "Veliki" }[v] || "") },
            grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" },
          },
          y: { ticks: { color: labelColor, font: { size: 11 } }, grid: { display: false } },
        },
        onHover(e, els) { canvasRef.current.style.cursor = els.length ? "pointer" : "default"; },
      },
    });

    const canvas = canvasRef.current;
    const onMove = (e) => {
      if (!chartRef.current) return;
      const pts = chartRef.current.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
      if (!pts.length) { setTt(t => ({ ...t, visible: false })); return; }
      const idx = pts[0].index;
      const t = sorted[idx];
      setTt({ visible: true, x: e.clientX, y: e.clientY,
        content: `<strong style="color:var(--color-text-primary)">${t.name}</strong><br>
          <span style="color:var(--color-text-secondary)">Sekcija:</span> ${t.section}<br>
          <span style="color:var(--color-text-secondary)">Effort:</span> ${EFFORT_LABEL[t.effort]}<br>
          <span style="color:var(--color-text-secondary)">Korisnici:</span> ${t.tip}` });
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", () => setTt(t => ({ ...t, visible: false })));
    return () => canvas.removeEventListener("mousemove", onMove);
  }, [tasks]);

  const height = Math.max(400, tasks.length * 28 + 60);

  return (
    <div>
      <TipLegend />
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
        Sortirano po prioritetu → effortu. Boja trake = tip korisnika. Dužina = effort.
      </p>
      <Tooltip {...tt} />
      <div style={{ position: "relative", width: "100%", height }}>
        <canvas ref={canvasRef} role="img" aria-label="Horizontal bar chart KP Auto projekata" />
      </div>
    </div>
  );
}

// ── SCATTER SWIM LANES ────────────────────────────────────────────────────────
function ScatterView({ tasks }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const [tt, setTt] = useState({ visible: false, content: "", x: 0, y: 0 });

  const TIPS = Object.keys(TIP_COLOR);
  const jitter = (val, idx) => val + (((idx * 1.618) % 1) - 0.5) * 0.55;

  useEffect(() => {
    if (!canvasRef.current || typeof window === "undefined") return;
    const Chart = window.Chart;
    if (!Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const gridColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
    const labelColor = isDark ? "#999" : "#888";

    const datasets = TIPS.map(tip => {
      const tipTasks = tasks.filter(t => t.tip === tip);
      return {
        label: tip,
        data: tipTasks.map((t, i) => ({
          x: jitter(t.effort, i + TIPS.indexOf(tip) * 10),
          y: TIPS.indexOf(tip) + 1,
          r: 8,
          _name: t.name, _tip: t.tip, _section: t.section, _effort: EFFORT_LABEL[t.effort],
        })),
        backgroundColor: TIP_BG[tip],
        borderColor: TIP_COLOR[tip],
        borderWidth: 1.5,
        pointRadius: 8,
      };
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: "bubble",
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 16, right: 20, bottom: 10, left: 10 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: {
            min: 0.3, max: 3.7,
            ticks: { color: labelColor, font: { size: 12 }, callback: v => ({ 1: "Mali", 2: "Srednji", 3: "Veliki" }[Math.round(v)] || ""), stepSize: 1 },
            grid: { color: gridColor },
            title: { display: true, text: "Effort", color: labelColor, font: { size: 12 } },
          },
          y: {
            min: 0.3, max: TIPS.length + 0.7,
            ticks: { color: labelColor, font: { size: 12 }, callback: v => TIPS[Math.round(v) - 1] || "", stepSize: 1 },
            grid: {
              color: ctx => Number.isInteger(ctx.tick.value + 0.5) ? "transparent" : gridColor,
              lineWidth: 1,
            },
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
        content: `<strong style="color:var(--color-text-primary)">${d._name}</strong><br>
          <span style="color:var(--color-text-secondary);font-size:11px">${d._section}</span><br><br>
          <span style="color:var(--color-text-secondary)">Effort:</span> ${d._effort}<br>
          <span style="color:var(--color-text-secondary)">Korisnici:</span> ${d._tip}` });
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", () => setTt(t => ({ ...t, visible: false })));
    return () => canvas.removeEventListener("mousemove", onMove);
  }, [tasks]);

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
        Svaki red (swim lane) = jedan segment korisnika. X osa = effort. Hover za detalje.
      </p>
      <Tooltip {...tt} />
      <div style={{ position: "relative", width: "100%", height: 320 }}>
        <canvas ref={canvasRef} role="img" aria-label="Scatter swim lanes KP Auto projekata" />
      </div>
    </div>
  );
}

// ── TABELA ────────────────────────────────────────────────────────────────────
function TableView({ tasks }) {
  const [sort, setSort] = useState("section");
  const SECTION_ORDER = ["Visok prioritet", "Srednji prioritet", "Nice to have", "Implementacija", "Završeno"];
  const sorted = [...tasks].sort((a, b) => {
    if (sort === "section") return SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
    if (sort === "effort") return a.effort - b.effort;
    if (sort === "tip") return a.tip.localeCompare(b.tip);
    return 0;
  });

  const thStyle = (id) => ({
    padding: "8px 12px", fontSize: 11, fontWeight: 500, textAlign: "left",
    color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)",
    cursor: "pointer", userSelect: "none",
    background: sort === id ? "var(--color-background-secondary)" : "transparent",
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle("name")} onClick={() => setSort("name")}>Naziv</th>
            <th style={thStyle("section")} onClick={() => setSort("section")}>Sekcija {sort === "section" ? "↑" : ""}</th>
            <th style={thStyle("effort")} onClick={() => setSort("effort")}>Effort {sort === "effort" ? "↑" : ""}</th>
            <th style={thStyle("tip")} onClick={() => setSort("tip")}>Tip korisnika {sort === "tip" ? "↑" : ""}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <td style={{ padding: "9px 12px", color: "var(--color-text-primary)" }}>{t.name}</td>
              <td style={{ padding: "9px 12px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{t.section}</td>
              <td style={{ padding: "9px 12px" }}>
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11,
                  background: t.effort === 1 ? "#e8f7f0" : t.effort === 2 ? "#fff4e0" : "#fdecea",
                  color: t.effort === 1 ? "#0F6E56" : t.effort === 2 ? "#854F0B" : "#A32D2D" }}>
                  {EFFORT_LABEL[t.effort]}
                </span>
              </td>
              <td style={{ padding: "9px 12px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: TIP_COLOR[t.tip] || "#888", flexShrink: 0 }} />
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

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function AutoPage() {
  const [token,   setToken]   = useState(null);
  const [tasks,   setTasks]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [view,    setView]    = useState("bubble");
  const [chartJs, setChartJs] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = () => setChartJs(true);
      document.head.appendChild(s);
    } else if (window.Chart) {
      setChartJs(true);
    }
  }, []);

  const onConnect = async (tok) => {
    setToken(tok);
    setLoading(true); setError("");
    try {
      const raw = await asanaFetch(
        `/tasks?project=${PROJECT_GID}&opt_fields=name,completed,memberships.section.name,custom_fields&limit=100`,
        tok
      );
      setTasks(raw.filter(t => !t.completed).map(parseTask));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return <TokenScreen onConnect={onConnect} />;

  const tabStyle = (id) => ({
    padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: view === id ? 500 : 400, transition: "all .15s",
    background: view === id ? "var(--color-background-primary)" : "transparent",
    color: view === id ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    borderBottom: view === id ? "2px solid var(--color-text-primary)" : "2px solid transparent",
    borderRadius: 0,
  });

  return (
    <div style={{ minHeight: "100vh", padding: "20px 20px 40px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <span style={{ fontSize: 24 }}>🚗</span>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>KP Automobili — Roadmap vizualizator</h1>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
              {tasks ? `${tasks.length} aktivnih projekata` : "Učitavanje..."}
            </p>
          </div>
          <button onClick={() => { setToken(null); setTasks(null); }}
            style={{ marginLeft: "auto", padding: "5px 12px", fontSize: 11 }}>
            Odjava
          </button>
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--color-border-secondary)", borderTopColor: "var(--color-text-primary)", animation: "spin .7s linear infinite" }} />
            Učitavam projekte iz Asane...
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {error && (
          <div style={{ padding: "12px 16px", background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-danger)", fontSize: 13, marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {tasks && !loading && (
          <>
            <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: 24 }}>
              {VIEWS.map(v => (
                <button key={v.id} onClick={() => setView(v.id)} style={tabStyle(v.id)}>{v.label}</button>
              ))}
            </div>

            {(!chartJs && ["bubble", "bar", "scatter"].includes(view)) ? (
              <div style={{ color: "var(--color-text-secondary)", fontSize: 13, padding: "20px 0" }}>Učitavanje Chart.js...</div>
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
