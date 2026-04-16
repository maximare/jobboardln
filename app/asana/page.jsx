"use client";
import { useState, useCallback } from "react";

const T = {
  bg: "#080b10", surface: "#0e1219", card: "#121720", cardHover: "#161c26",
  border: "#1e2535", borderLight: "#252f42",
  accent: "#00d4aa", accentGlow: "rgba(0,212,170,0.2)",
  blue: "#4f8ef7", yellow: "#f5c542", red: "#f25c5c",
  text: "#e8edf5", textSub: "#6e7d9e", textMuted: "#3d4a62",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'Sora', 'DM Sans', sans-serif",
};

const STATUS = {
  "Not Started": { color: "#3d4a62", bg: "#151a24", dot: "#3d4a62" },
  "In Progress":  { color: "#4f8ef7", bg: "#0d1628", dot: "#4f8ef7" },
  "Completed":    { color: "#00d4aa", bg: "#071a15", dot: "#00d4aa" },
  "Blocked":      { color: "#f25c5c", bg: "#1e0e0e", dot: "#f25c5c" },
  "On Hold":      { color: "#f5c542", bg: "#1c1806", dot: "#f5c542" },
};

const PROXY = "/api/asana";

async function asanaFetch(path, token) {
  const res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`, {
    headers: { "x-asana-token": token },
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "Asana greška");
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data;
}

const mapStatus = (t) => {
  if (t.completed) return "Completed";
  const cf = t.custom_fields?.find(f => f.name?.toLowerCase().includes("status"));
  if (cf?.enum_value?.name) {
    const v = cf.enum_value.name;
    if (/block/i.test(v)) return "Blocked";
    if (/hold/i.test(v)) return "On Hold";
    if (/progress|doing/i.test(v)) return "In Progress";
    if (/done|complete/i.test(v)) return "Completed";
  }
  const as = (t.assignee_status || "").toLowerCase();
  if (as.includes("today") || as.includes("upcoming")) return "In Progress";
  return "Not Started";
};

const Avatar = ({ name = "?" }) => {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${h},50%,35%)`, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff",
      fontFamily: T.mono }}>
      {initials}
    </div>
  );
};

function Spinner({ label = "Učitavanje..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "56px 0" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%",
        border: `2px solid ${T.border}`, borderTopColor: T.accent,
        animation: "spin .7s linear infinite" }} />
      <span style={{ color: T.textSub, fontSize: 12 }}>{label}</span>
    </div>
  );
}

function Dashboard({ tasks }) {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.status === "Completed").length;
  const prog    = tasks.filter(t => t.status === "In Progress").length;
  const blocked = tasks.filter(t => t.status === "Blocked").length;
  const overdue = tasks.filter(t => t.due_on && new Date(t.due_on) < new Date() && t.status !== "Completed").length;
  const pct     = total ? Math.round(done / total * 100) : 0;

  const counts = Object.keys(STATUS)
    .map(s => ({ s, c: tasks.filter(t => t.status === s).length }))
    .filter(x => x.c > 0);

  const circ = 2 * Math.PI * 38;
  let off = 0;
  const segs = counts.map(({ s, c }) => {
    const dash = (c / total) * circ;
    const el = { s, dash, off, color: STATUS[s].dot };
    off += dash;
    return el;
  });

  const people = [...new Set(tasks.map(t => t.assignee).filter(Boolean))].map(a => ({
    name: a,
    total: tasks.filter(t => t.assignee === a).length,
    done:  tasks.filter(t => t.assignee === a && t.status === "Completed").length,
  }));

  const Stat = ({ label, val, color, sub }) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: "16px 18px", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: color || T.text,
        fontFamily: T.mono, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 9, color: T.textSub, marginTop: 6, fontWeight: 700,
        letterSpacing: ".07em", textTransform: "uppercase" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Stat label="Ukupno" val={total} />
        <Stat label="Završeno" val={done} color={T.accent} sub={`${pct}%`} />
        <Stat label="U toku" val={prog} color={T.blue} />
        <Stat label="Blokirano" val={blocked} color={T.red} />
        <Stat label="Kasni" val={overdue} color={T.yellow} />
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Ukupan napredak</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: T.accent, fontFamily: T.mono }}>{pct}%</span>
        </div>
        <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3,
            background: "linear-gradient(90deg,#00d4aa,#00ffcc)", transition: "width .8s ease" }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {counts.map(({ s, c }) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS[s].dot }} />
              <span style={{ fontSize: 10, color: T.textSub }}>
                {s}: <b style={{ color: T.text }}>{c}</b>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "16px 18px", display: "flex", alignItems: "center", gap: 18 }}>
          <svg width={96} height={96} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={38} fill="none" stroke={T.border} strokeWidth={10} />
            {segs.map((seg, i) => (
              <circle key={i} cx={50} cy={50} r={38} fill="none"
                stroke={seg.color} strokeWidth={10}
                strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
                strokeDashoffset={-seg.off}
                style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
            ))}
            <text x={50} y={55} textAnchor="middle" fill={T.text}
              fontSize={13} fontWeight={800} fontFamily={T.mono}>{pct}%</text>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {counts.map(({ s, c }) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: STATUS[s].dot }} />
                <span style={{ fontSize: 10, color: T.textSub, minWidth: 76 }}>{s}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{c}</span>
              </div>
            ))}
          </div>
        </div>

        {people.length > 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "16px 18px", flex: 1, minWidth: 210 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.textSub,
              letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>Po članu tima</div>
            {people.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <Avatar name={p.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: T.text }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: T.textSub, fontFamily: T.mono }}>{p.done}/{p.total}</span>
                  </div>
                  <div style={{ height: 3, background: T.border, borderRadius: 2 }}>
                    <div style={{ height: "100%", borderRadius: 2, background: T.accent,
                      width: `${p.total ? p.done / p.total * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kanban({ tasks }) {
  return (
    <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
      {Object.entries(STATUS).map(([status, s]) => {
        const col = tasks.filter(t => t.status === status);
        return (
          <div key={status} style={{ minWidth: 185, flex: 1, background: T.card,
            border: `1px solid ${T.border}`, borderRadius: 10, padding: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: s.color,
                letterSpacing: ".08em", textTransform: "uppercase", fontFamily: T.mono }}>{status}</span>
              <span style={{ marginLeft: "auto", fontSize: 9, color: T.textMuted,
                background: T.border, borderRadius: 10, padding: "1px 6px", fontFamily: T.mono }}>{col.length}</span>
            </div>
            {col.length === 0
              ? <div style={{ color: T.textMuted, fontSize: 11, textAlign: "center", padding: "20px 0" }}>—</div>
              : col.map((task, i) => (
                <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`,
                  borderLeft: `2px solid ${s.dot}`, borderRadius: 7, padding: "9px 11px", marginBottom: 7 }}>
                  <div style={{ fontSize: 11, color: T.text, fontWeight: 500,
                    lineHeight: 1.45, marginBottom: 7 }}>{task.name}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {task.assignee
                      ? <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Avatar name={task.assignee} />
                          <span style={{ fontSize: 9, color: T.textSub }}>{task.assignee.split(" ")[0]}</span>
                        </div>
                      : <span />}
                    {task.due_on && (
                      <span style={{ fontSize: 9, color: T.textMuted, fontFamily: T.mono }}>
                        {new Date(task.due_on).toLocaleDateString("sr-RS", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        );
      })}
    </div>
  );
}

function Gantt({ tasks }) {
  const today = new Date();
  const valid = tasks.filter(t => t.due_on);
  if (!valid.length) return (
    <div style={{ color: T.textSub, padding: "40px 0", textAlign: "center" }}>
      Nema taskova sa due datumima.
    </div>
  );

  const allD = valid.flatMap(t => [new Date(t.due_on), new Date(t.created_at || t.due_on)]);
  const minD = new Date(Math.min(...allD)); minD.setDate(minD.getDate() - 3);
  const maxD = new Date(Math.max(...allD)); maxD.setDate(maxD.getDate() + 8);
  const span = (maxD - minD) / 86400000;
  const pct  = d => Math.max(0, Math.min(100, (new Date(d) - minD) / 86400000 / span * 100));
  const todayP = pct(today);

  const weeks = [];
  const cur = new Date(minD);
  while (cur <= maxD) { weeks.push(new Date(cur)); cur.setDate(cur.getDate() + 7); }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 660 }}>
        <div style={{ display: "flex", marginBottom: 4, paddingLeft: 210 }}>
          <div style={{ flex: 1, position: "relative", height: 18 }}>
            {weeks.map((w, i) => (
              <span key={i} style={{ position: "absolute", left: `${pct(w)}%`, fontSize: 8,
                color: T.textMuted, fontFamily: T.mono, whiteSpace: "nowrap", transform: "translateX(-50%)" }}>
                {w.toLocaleDateString("sr-RS", { day: "numeric", month: "short" })}
              </span>
            ))}
          </div>
        </div>
        {valid.map((task, i) => {
          const start = new Date(task.created_at || minD);
          const end   = new Date(task.due_on);
          const left  = pct(start < minD ? minD : start);
          const width = Math.max(pct(end) - left, 1.5);
          const late  = end < today && task.status !== "Completed";
          const col   = late ? T.red : (STATUS[task.status]?.dot || T.blue);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 5,
              background: i % 2 === 0 ? T.card : "transparent", borderRadius: 5, padding: "4px 0" }}>
              <div style={{ width: 210, flexShrink: 0, paddingLeft: 8, paddingRight: 8 }}>
                <div style={{ fontSize: 10, color: T.text, fontWeight: 500,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.name}</div>
                <div style={{ fontSize: 8, color: T.textMuted, marginTop: 1 }}>{task.assignee || "—"}</div>
              </div>
              <div style={{ flex: 1, position: "relative", height: 20 }}>
                {weeks.map((w, wi) => (
                  <div key={wi} style={{ position: "absolute", left: `${pct(w)}%`,
                    top: 0, bottom: 0, width: 1, background: T.border, opacity: .4 }} />
                ))}
                <div style={{ position: "absolute", left: `${todayP}%`,
                  top: 0, bottom: 0, width: 1, background: T.accent, opacity: .5, zIndex: 2 }} />
                <div style={{ position: "absolute", left: `${left}%`, width: `${width}%`, height: "100%",
                  borderRadius: 3, background: `${col}20`, border: `1px solid ${col}55`,
                  display: "flex", alignItems: "center", paddingLeft: 4, overflow: "hidden" }}>
                  <span style={{ fontSize: 8, color: col, fontFamily: T.mono, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {end.toLocaleDateString("sr-RS", { day: "numeric", month: "short" })}{late ? " ⚠" : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ paddingLeft: 210, position: "relative", height: 14, marginTop: 2 }}>
          <span style={{ position: "absolute", left: `${todayP}%`, fontSize: 8,
            color: T.accent, fontFamily: T.mono, transform: "translateX(-50%)" }}>danas</span>
        </div>
      </div>
    </div>
  );
}

function TokenScreen({ onConnect }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const connect = async () => {
    if (!token.trim()) return;
    setLoading(true); setErr("");
    try {
      const me = await asanaFetch("/users/me?opt_fields=name", token.trim());
      onConnect(token.trim(), me.name);
    } catch (e) {
      setErr("Greška: " + e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: T.sans }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🌿</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.text, margin: "0 0 6px", letterSpacing: "-.02em" }}>
            Asana Vizualizator
          </h1>
          <p style={{ fontSize: 12, color: T.textSub, margin: 0 }}>Unesi Asana Personal Access Token</p>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color: T.textSub,
            letterSpacing: ".08em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>
            Personal Access Token
          </label>
          <input type="password" value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === "Enter" && connect()}
            placeholder="1/123456789:abcdef..."
            style={{ width: "100%", boxSizing: "border-box",
              background: T.surface, border: `1px solid ${T.borderLight}`,
              borderRadius: 7, padding: "9px 11px", color: T.text,
              fontSize: 12, fontFamily: T.mono, outline: "none", marginBottom: 10 }} />
          <button onClick={connect} disabled={!token.trim() || loading} style={{
            width: "100%", padding: "10px 0", borderRadius: 7, border: "none",
            background: token.trim() && !loading ? T.accent : T.border,
            color: token.trim() && !loading ? "#000" : T.textMuted,
            fontSize: 12, fontWeight: 700, cursor: token.trim() && !loading ? "pointer" : "default",
            fontFamily: T.sans, transition: "all .2s",
          }}>
            {loading ? "Povezivanje..." : "Poveži se →"}
          </button>
          {err && <div style={{ marginTop: 8, color: T.red, fontSize: 11 }}>{err}</div>}
        </div>
        <div style={{ marginTop: 14, background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: "11px 14px" }}>
          <div style={{ fontSize: 10, color: T.textSub, lineHeight: 1.7 }}>
            <b style={{ color: T.text }}>Kako doći do tokena:</b><br />
            1. <span style={{ color: T.accent }}>app.asana.com</span> → slika profila<br />
            2. <b>My Settings → Apps → Manage Developer Apps</b><br />
            3. <b>New access token</b> → kopiraj
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = ["Dashboard", "Kanban", "Gantt"];

export default function AsanaPage() {
  const [token, setToken]   = useState(null);
  const [user,  setUser]    = useState(null);
  const [step,  setStep]    = useState("ws");
  const [workspaces, setWorkspaces] = useState(null);
  const [projects,   setProjects]   = useState(null);
  const [tasks,      setTasks]      = useState(null);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Učitavanje...");
  const [error,   setError]   = useState("");
  const [tab, setTab] = useState("Dashboard");

  const go = useCallback(async (fn, label = "Učitavanje...") => {
    setLoading(true); setLoadingLabel(label); setError("");
    try { await fn(); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  const onConnect = (tok, name) => {
    setToken(tok); setUser(name);
    go(async () => {
      const ws = await asanaFetch("/workspaces?opt_fields=name,gid", tok);
      setWorkspaces(Array.isArray(ws) ? ws : [ws]);
    }, "Učitavam workspace-ove...");
  };

  const selWS = (ws) => go(async () => {
    const ps = await asanaFetch(`/projects?workspace=${ws.gid}&opt_fields=name,gid`, token);
    setProjects(Array.isArray(ps) ? ps : [ps]);
    setStep("proj");
  }, "Učitavam projekte...");

  const selProj = (p) => go(async () => {
    setProjectName(p.name);
    const raw = await asanaFetch(
      `/tasks?project=${p.gid}&opt_fields=name,completed,due_on,created_at,assignee.name,assignee_status,custom_fields&limit=100`,
      token
    );
    const arr = Array.isArray(raw) ? raw : [raw];
    setTasks(arr.map(t => ({
      name: t.name,
      status: mapStatus(t),
      assignee: t.assignee?.name || null,
      due_on: t.due_on || null,
      created_at: t.created_at?.slice(0, 10) || null,
    })));
    setStep("tasks");
  }, "Učitavam taskove...");

  const back = () => {
    if (step === "tasks") { setStep("proj"); setTasks(null); setProjectName(""); }
    else if (step === "proj") { setStep("ws"); setProjects(null); }
  };

  if (!token) return <TokenScreen onConnect={onConnect} />;

  const btnTab = (active) => ({
    padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
    fontFamily: T.sans, fontSize: 11, fontWeight: 700, transition: "all .15s",
    background: active ? T.accent : T.card,
    color: active ? "#000" : T.textSub,
    boxShadow: active ? `0 0 12px ${T.accentGlow}` : "none",
  });

  const listBtn = (label, onClick) => (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: "12px 14px", marginBottom: 7, cursor: "pointer",
      color: T.text, fontSize: 12, fontWeight: 600, fontFamily: T.sans,
      transition: "border-color .15s, background .15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.cardHover; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; }}
    >{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text,
      fontFamily: T.sans, padding: "18px 16px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: "linear-gradient(135deg,#00d4aa,#00a8ff)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌿</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.02em" }}>Asana Vizualizator</div>
          <div style={{ fontSize: 10, color: T.textSub }}>{projectName || `Zdravo, ${user}`}</div>
        </div>
        {step !== "ws" && (
          <button onClick={back} style={{ ...btnTab(false), marginLeft: "auto", fontSize: 10, padding: "4px 10px" }}>
            ← Nazad
          </button>
        )}
      </div>

      {loading && <Spinner label={loadingLabel} />}

      {error && !loading && (
        <div style={{ background: "#1e0e0e", border: "1px solid #f25c5c44", borderRadius: 8,
          padding: "11px 14px", color: T.red, fontSize: 12, marginBottom: 14 }}>⚠️ {error}</div>
      )}

      {!loading && step === "ws" && workspaces && (
        <div>
          <div style={{ fontSize: 9, color: T.textSub, letterSpacing: ".08em",
            textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Izaberi workspace</div>
          {workspaces.map(ws => listBtn(`📁 ${ws.name}`, () => selWS(ws)))}
        </div>
      )}

      {!loading && step === "proj" && projects && (
        <div>
          <div style={{ fontSize: 9, color: T.textSub, letterSpacing: ".08em",
            textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Izaberi projekat</div>
          {projects.length === 0
            ? <div style={{ color: T.textSub, fontSize: 12 }}>Nema projekata.</div>
            : projects.map(p => listBtn(`📋 ${p.name}`, () => selProj(p)))}
        </div>
      )}

      {!loading && step === "tasks" && tasks && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
            {TABS.map(t => <button key={t} onClick={() => setTab(t)} style={btnTab(tab === t)}>{t}</button>)}
            <span style={{ marginLeft: "auto", fontSize: 10, color: T.textMuted,
              fontFamily: T.mono }}>{tasks.length} taskova</span>
          </div>
          {tab === "Dashboard" && <Dashboard tasks={tasks} />}
          {tab === "Kanban"    && <Kanban tasks={tasks} />}
          {tab === "Gantt"     && <Gantt tasks={tasks} />}
        </div>
      )}
    </div>
  );
}
