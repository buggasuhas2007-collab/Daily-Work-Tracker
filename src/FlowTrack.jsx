import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Calendar as CalIcon, LayoutGrid, CheckCircle2, Search as SearchIcon,
  BarChart3, ChevronDown, ChevronRight, Paperclip, X, Trash2, Clock,
  Check, Circle, PauseCircle, Loader2, FileText, Menu, Download, Upload,
  Flame, User, Edit2, Monitor, Play, Pause, RefreshCw
} from "lucide-react";

/* ── storage keys ── */
const K_TASKS = "ft:tasks:v1";
const K_NAME = "ft:username:v1";
const K_AUTOLOGS = "ft:autologs:v1";
const K_LAST_SYNC = "ft:lastsync:v1";

/* ── premium palette: slate base + glowing neon details ── */
const C = {
  bg: "#07080B",
  panel: "rgba(17, 20, 28, 0.7)",      // glass panel
  panelElevated: "rgba(28, 33, 46, 0.85)",
  border: "rgba(255, 255, 255, 0.06)",
  borderActive: "rgba(255, 172, 51, 0.25)",
  txt: "#F3F4F6",
  dim: "#9CA3AF",
  dim2: "#4B5563",
  amber: "#F59E0B",
  amberGlow: "rgba(245, 158, 11, 0.15)",
  green: "#10B981",
  greenGlow: "rgba(16, 185, 129, 0.15)",
  red: "#EF4444",
  redGlow: "rgba(239, 68, 68, 0.15)",
  blue: "#3B82F6",
  blueGlow: "rgba(59, 130, 246, 0.15)",
};

const PRIORITIES = {
  critical: { label: "Critical", c: C.red },
  high: { label: "High", c: C.amber },
  medium: { label: "Medium", c: C.blue },
  low: { label: "Low", c: C.dim },
};

const STATUSES = {
  not_started: { label: "Not started", c: C.dim, Icon: Circle },
  in_progress: { label: "In progress", c: C.amber, Icon: Loader2 },
  blocked: { label: "Blocked", c: C.red, Icon: PauseCircle },
  completed: { label: "Completed", c: C.green, Icon: CheckCircle2 },
};

const TAGS = ["AI", "Coding", "College", "Research", "Placement", "Reading", "Personal"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const fmtShort = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function minutesBetween(a, b) {
  if (!a || !b) return 0;
  const [h1, m1] = a.split(":").map(Number);
  const [h2, m2] = b.split(":").map(Number);
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return d > 0 ? d : 0;
}
const fmtDur = (m) => `${Math.floor(m / 60)}h ${m % 60}m`;
const fmtSeconds = (s) => {
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

/* ── storage (localStorage — per browser, no account needed) ── */
async function loadTasks() {
  try {
    const raw = localStorage.getItem(K_TASKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function saveTasks(tasks) {
  try {
    localStorage.setItem(K_TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error("save failed", e);
  }
}

/* ── focus streak helper ── */
function calculateStreak(tasks) {
  const completedDates = new Set(
    tasks
      .filter((t) => t.status === "completed" && t.completedDate)
      .map((t) => t.completedDate)
  );
  if (completedDates.size === 0) return 0;

  const today = todayISO();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  let currentStreak = 0;
  let checkDate = new Date();

  if (completedDates.has(today)) {
    // Streak active checking starting today
  } else if (completedDates.has(yesterdayISO)) {
    // Streak active checking starting yesterday
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    return 0; // Streak broken
  }

  while (true) {
    const isoString = checkDate.toISOString().slice(0, 10);
    if (completedDates.has(isoString)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return currentStreak;
}

/* ── custom SVG line chart for productivity trend ── */
function SVGLinesChart({ data, color = C.amber, label = "Completed" }) {
  const width = 500;
  const height = 150;
  const paddingX = 35;
  const paddingY = 25;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const maxVal = Math.max(...data.map((d) => d.val), 3); // cap peak to min 3 for scaling aesthetics
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * chartWidth;
    const y = height - paddingY - (d.val / maxVal) * chartHeight;
    return { x, y, label: d.label, val: d.val };
  });

  let pathD = "";
  let areaD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    areaD = `M ${points[0].x} ${height - paddingY} L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
      areaD += ` L ${points[i].x} ${points[i].y}`;
    }
    areaD += ` L ${points[points.length - 1].x} ${height - paddingY} Z`;
  }

  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={color} floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: 4 }).map((_, i) => {
          const y = paddingY + (i / 3) * chartHeight;
          return (
            <line key={i} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          );
        })}

        {/* Shaded area */}
        {areaD && <path d={areaD} fill="url(#areaGrad)" />}

        {/* Glowing trend line */}
        {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="3" filter="url(#glow)" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Points */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} style={{ cursor: "pointer" }}>
            <circle cx={p.x} cy={p.y} r={hoveredIdx === i ? 6 : 4} fill={hoveredIdx === i ? color : C.bg} stroke={color} strokeWidth="2" style={{ transition: "r 0.1s ease" }} />
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
          </g>
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={height - 8} fill="rgba(255,255,255,0.25)" fontSize="9" textAnchor="middle" fontFamily="inherit">
            {p.label}
          </text>
        ))}

        {/* Y labels */}
        {Array.from({ length: 4 }).map((_, i) => {
          const val = Math.round(maxVal - (i / 3) * maxVal);
          const y = paddingY + (i / 3) * chartHeight + 3;
          return (
            <text key={i} x={paddingX - 10} y={y} fill="rgba(255,255,255,0.25)" fontSize="9" textAnchor="end" fontFamily="inherit" style={{ fontVariantNumeric: "tabular-nums" }}>
              {val}
            </text>
          );
        })}
      </svg>
      {hoveredIdx !== null && (
        <div style={{
          position: "absolute",
          left: `${(points[hoveredIdx].x / width) * 100}%`,
          top: `${(points[hoveredIdx].y / height) * 100 - 30}%`,
          transform: "translateX(-50%)",
          background: C.panelElevated,
          border: `1px solid ${C.border}`,
          padding: "5px 9px",
          borderRadius: 6,
          fontSize: 11,
          color: C.txt,
          pointerEvents: "none",
          boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
          zIndex: 10,
        }}>
          <strong>{points[hoveredIdx].val}</strong> {label} ({points[hoveredIdx].label})
        </div>
      )}
    </div>
  );
}

/* ── custom SVG donut chart ── */
function SVGPieChart({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const R = 36;
  const C_circ = 2 * Math.PI * R; // 226.19
  let accumulatedPercent = 0;

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", width: "100%", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
          {total === 0 ? (
            <circle cx="50" cy="50" r={R} stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="transparent" />
          ) : (
            data.map((item) => {
              if (item.count === 0) return null;
              const percent = item.count / total;
              const rotation = accumulatedPercent * 360;
              accumulatedPercent += percent;

              return (
                <circle
                  key={item.key}
                  cx="50"
                  cy="50"
                  r={R}
                  stroke={item.color}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${percent * C_circ} ${C_circ}`}
                  strokeDashoffset={0}
                  transform={`rotate(${rotation} 50 50)`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 0.3s ease, transform 0.3s ease" }}
                />
              );
            })
          )}
        </svg>
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.txt, lineHeight: 1.1 }}>{total}</div>
          <div style={{ fontSize: 8.5, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>Tasks</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 140 }}>
        {data.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
              <span style={{ color: C.dim, flex: 1 }}>{item.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: C.txt }}>
                {item.count} <span style={{ fontSize: 10, color: C.dim2, fontWeight: 400, marginLeft: 4 }}>({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── basic helper components ── */
function Pill({ children, color, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color + "1a" : "transparent",
        border: `1px solid ${active ? color : C.border}`,
        color: active ? color : C.dim,
        borderRadius: 999, padding: "4px 12px", fontSize: 11,
        cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap",
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

function Bar({ pct, color = C.amber }) {
  return (
    <div style={{ height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .3s ease" }} />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: C.dim, marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputS = {
  background: "rgba(255, 255, 255, 0.02)",
  border: `1px solid ${C.border}`,
  color: C.txt,
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
  transition: "all 0.2s ease",
};

/* ── upgraded task card with glassmorphism ── */
function TaskCard({ task, onUpdate, onDelete, onComplete }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);
  const S = STATUSES[task.status];
  const P = PRIORITIES[task.priority];

  const addFiles = (list) => {
    const files = Array.from(list).map((f) => ({
      id: uid(), name: f.name, size: f.size,
    }));
    onUpdate({ ...task, files: [...(task.files || []), ...files] });
  };

  return (
    <div className="task-card" style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      overflow: "hidden",
      backdropFilter: "blur(12px)",
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", gap: 14, alignItems: "center" }}
      >
        {open ? <ChevronDown size={14} color={C.dim} /> : <ChevronRight size={14} color={C.dim} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: C.txt }}>{task.title}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: P.c,
              background: P.c + "11",
              border: `1px solid ${P.c}33`,
              borderRadius: 4,
              padding: "1px 6px"
            }}>
              {P.label}
            </span>
            {(task.tags || []).map((t) => (
              <span key={t} style={{ fontSize: 10, color: C.dim, background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "1.5px 7px" }}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5, color: C.dim }}>
            {task.start && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} color={C.dim2} /> {task.start} → {task.end || "—"}
              </span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: S.c }}>
              <S.Icon size={11} className={task.status === "in_progress" ? "anim-rotate" : ""} /> {S.label}
            </span>
            {(task.files || []).length > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Paperclip size={11} color={C.dim2} /> {(task.files || []).length}
              </span>
            )}
          </div>
        </div>
        <div style={{ width: 84, textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.txt, marginBottom: 5, fontVariantNumeric: "tabular-nums" }}>
            {task.progress}%
          </div>
          <Bar pct={task.progress} color={task.status === "blocked" ? C.red : C.amber} />
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 18, display: "grid", gap: 16, background: "rgba(0,0,0,0.1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12 }}>
            <Field label="Start">
              <input type="time" style={inputS} value={task.start || ""}
                onChange={(e) => onUpdate({ ...task, start: e.target.value })} />
            </Field>
            <Field label="End">
              <input type="time" style={inputS} value={task.end || ""}
                onChange={(e) => onUpdate({ ...task, end: e.target.value })} />
            </Field>
            <Field label="Status">
              <select style={inputS} value={task.status}
                onChange={(e) => onUpdate({ ...task, status: e.target.value })}>
                {Object.entries(STATUSES).filter(([k]) => k !== "completed").map(([k, v]) => (
                  <option key={k} value={k} style={{ background: "#11141C" }}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select style={inputS} value={task.priority}
                onChange={(e) => onUpdate({ ...task, priority: e.target.value })}>
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k} style={{ background: "#11141C" }}>{v.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={`Progress — ${task.progress}%`}>
            <input type="range" min="0" max="100" step="5" value={task.progress}
              onChange={(e) => onUpdate({ ...task, progress: +e.target.value })}
              style={{ width: "100%", accentColor: C.amber }} />
          </Field>

          <Field label="Tags">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TAGS.map((t) => {
                const on = (task.tags || []).includes(t);
                return (
                  <Pill key={t} color={C.amber} active={on}
                    onClick={() => onUpdate({
                      ...task,
                      tags: on ? task.tags.filter((x) => x !== t) : [...(task.tags || []), t],
                    })}>
                    {t}
                  </Pill>
                );
              })}
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            <Field label="Work to be done">
              <textarea rows={6} style={{ ...inputS, resize: "vertical", lineHeight: 1.6 }}
                placeholder={"• Understand attention\n• Implement transformer\n• Push to GitHub"}
                value={task.planned || ""}
                onChange={(e) => onUpdate({ ...task, planned: e.target.value })} />
            </Field>
            <Field label="Work completed">
              <textarea rows={6} style={{ ...inputS, resize: "vertical", lineHeight: 1.6 }}
                placeholder={"What actually got done. Be honest — this is the part\nyou'll read back later."}
                value={task.done || ""}
                onChange={(e) => onUpdate({ ...task, done: e.target.value })} />
            </Field>
          </div>

          <Field label="Files">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              style={{
                border: `1px dashed ${C.border}`, borderRadius: 8, padding: 16,
                textAlign: "center", color: C.dim, fontSize: 12, cursor: "pointer",
                background: "rgba(255,255,255,0.01)",
              }}
            >
              Drop files here, or click to attach
            </div>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            {(task.files || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {task.files.map((f) => (
                  <span key={f.id} style={{
                    display: "flex", alignItems: "center", gap: 6, background: C.panelElevated,
                    border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11.5, color: C.dim,
                  }}>
                    <FileText size={11} /> {f.name}
                    <X size={11} style={{ cursor: "pointer" }}
                      onClick={() => onUpdate({ ...task, files: task.files.filter((x) => x.id !== f.id) })} />
                  </span>
                ))}
              </div>
            )}
          </Field>

          <div style={{ display: "flex", gap: 8, justifycontent: "flex-end", paddingTop: 4 }}>
            <button onClick={() => onDelete(task.id)} style={{
              background: "transparent", border: `1px solid ${C.border}`, color: C.dim,
              borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}>
              <Trash2 size={13} /> Delete
            </button>
            <button onClick={() => onComplete(task.id)} style={{
              background: C.green, border: "none", color: "#0B1A12", fontWeight: 600,
              borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
              boxShadow: `0 4px 12px ${C.green}22`,
            }}>
              <Check size={13} strokeWidth={2.5} /> Mark complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── new task form ── */
function NewTask({ onAdd, onCancel, prefill }) {
  const [t, setT] = useState({
    title: prefill?.title || "",
    start: prefill?.start || "",
    end: prefill?.end || "",
    priority: prefill?.priority || "medium",
    tags: prefill?.tags || []
  });

  // Keep prefill sync in case it loads asynchronously
  useEffect(() => {
    if (prefill) {
      setT({
        title: prefill.title,
        start: prefill.start,
        end: prefill.end,
        priority: prefill.priority,
        tags: prefill.tags
      });
    }
  }, [prefill]);

  const submit = () => {
    if (!t.title.trim()) return;
    onAdd({
      id: uid(), title: t.title.trim(), start: t.start, end: t.end,
      priority: t.priority, tags: t.tags, status: "not_started",
      progress: 0, planned: "", done: "", files: [],
      date: todayISO(), createdAt: Date.now(),
    });
  };
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.borderActive}`,
      borderRadius: 12,
      padding: 18,
      display: "grid",
      gap: 14,
      boxShadow: `0 8px 32px ${C.amberGlow}`,
      backdropFilter: "blur(12px)",
    }}>
      <input autoFocus style={{ ...inputS, fontSize: 14.5, background: "rgba(255,255,255,0.03)" }} placeholder="What are you working on?"
        value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && submit()} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10 }}>
        <Field label="Start"><input type="time" style={inputS} value={t.start} onChange={(e) => setT({ ...t, start: e.target.value })} /></Field>
        <Field label="End"><input type="time" style={inputS} value={t.end} onChange={(e) => setT({ ...t, end: e.target.value })} /></Field>
        <Field label="Priority">
          <select style={inputS} value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value })}>
            {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k} style={{ background: "#11141C" }}>{v.label}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TAGS.map((tag) => (
          <Pill key={tag} color={C.amber} active={t.tags.includes(tag)}
            onClick={() => setT({ ...t, tags: t.tags.includes(tag) ? t.tags.filter((x) => x !== tag) : [...t.tags, tag] })}>
            {tag}
          </Pill>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={submit} style={{ background: C.amber, border: "none", color: "#1A1204", fontWeight: 600, borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Add task</button>
      </div>
    </div>
  );
}

/* ── main app ── */
export default function FlowTrack() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("today");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [openDate, setOpenDate] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  
  /* ── username setup ── */
  const [username, setUsername] = useState("Developer");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  
  /* ── dashboard time filter and subtabs ── */
  const [range, setRange] = useState("7d");
  const [dashTab, setDashTab] = useState("overview"); // "overview" or "auto"
  const [prefillData, setPrefillData] = useState(null);

  /* ── desktop auto tracker state ── */
  const [trackerStatus, setTrackerStatus] = useState("offline"); // "active", "paused", "offline"
  const [autoLogs, setAutoLogs] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(0);

  const impRef = useRef(null);

  // Initialize storage values
  useEffect(() => {
    loadTasks().then((t) => {
      setTasks(t);
      setLoading(false);
    });

    const savedName = localStorage.getItem(K_NAME);
    if (savedName) {
      setUsername(savedName);
      setTempName(savedName);
    } else {
      setTempName("Developer");
    }

    const savedLogs = localStorage.getItem(K_AUTOLOGS);
    if (savedLogs) {
      setAutoLogs(JSON.parse(savedLogs));
    }

    const savedSync = localStorage.getItem(K_LAST_SYNC);
    if (savedSync) {
      setLastSyncTime(parseInt(savedSync));
    }
  }, []);

  // Poll Local Python Desktop Tracker every 15 seconds
  useEffect(() => {
    const checkTracker = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/status");
        if (res.ok) {
          const data = await res.json();
          setTrackerStatus(data.status); // "active" or "paused"
          
          if (data.status === "active") {
            const logsRes = await fetch(`http://localhost:5001/api/logs?since=${lastSyncTime}`);
            if (logsRes.ok) {
              const logsData = await logsRes.json();
              if (logsData.logs && logsData.logs.length > 0) {
                const newLogs = logsData.logs;
                setAutoLogs((prev) => {
                  const merged = [...prev, ...newLogs];
                  // Remove duplicates by timestamp
                  const unique = [];
                  const seen = new Set();
                  merged.forEach(item => {
                    const key = `${item.timestamp}-${item.app}`;
                    if (!seen.has(key)) {
                      seen.add(key);
                      unique.push(item);
                    }
                  });
                  localStorage.setItem(K_AUTOLOGS, JSON.stringify(unique));
                  return unique;
                });

                const maxTime = Math.max(...newLogs.map(l => l.timestamp));
                const nextSync = maxTime + 1;
                setLastSyncTime(nextSync);
                localStorage.setItem(K_LAST_SYNC, nextSync.toString());
              }
            }
          }
        } else {
          setTrackerStatus("offline");
        }
      } catch {
        setTrackerStatus("offline");
      }
    };

    checkTracker(); // Initial run
    const interval = setInterval(checkTracker, 15000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  const toggleTracker = async () => {
    if (trackerStatus === "offline") return;
    try {
      const res = await fetch("http://localhost:5001/api/toggle", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTrackerStatus(data.status);
      }
    } catch (e) {
      console.error("Failed to toggle tracker", e);
    }
  };

  const clearAutoLogs = () => {
    if (window.confirm("Are you sure you want to clear your local auto-activity logs? This won't delete logged tasks.")) {
      setAutoLogs([]);
      setLastSyncTime(0);
      localStorage.setItem(K_AUTOLOGS, "[]");
      localStorage.setItem(K_LAST_SYNC, "0");
    }
  };

  const deleteAutoBlock = (block) => {
    setAutoLogs((prev) => {
      // Filter out raw logs that fall into the block's start and end times
      const filtered = prev.filter(log => log.timestamp < block.startTimestamp || log.timestamp > block.endTimestamp || log.app !== block.app);
      localStorage.setItem(K_AUTOLOGS, JSON.stringify(filtered));
      return filtered;
    });
  };

  const persist = (next) => {
    setTasks(next);
    saveTasks(next);
  };

  const saveName = () => {
    const trimmed = tempName.trim();
    if (trimmed) {
      setUsername(trimmed);
      localStorage.setItem(K_NAME, trimmed);
    }
    setIsEditingName(false);
  };

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  };

  /* ── base task splits ── */
  const today = tasks.filter((t) => t.status !== "completed");
  const done = tasks.filter((t) => t.status === "completed");

  const cleanTitle = (title) => {
    if (!title) return "";
    const suffixes = [
      " - Google Chrome",
      " - Microsoft Edge",
      " - Mozilla Firefox",
      " - Brave",
      " - Opera",
      " - Internet Explorer"
    ];
    let clean = title;
    suffixes.forEach((suffix) => {
      if (clean.endsWith(suffix)) {
        clean = clean.slice(0, -suffix.length);
      }
    });
    return clean;
  };

  /* ── auto-tracker logs aggregation into clean blocks ── */
  const aggregatedBlocks = useMemo(() => {
    if (autoLogs.length === 0) return [];
    
    // Sort logs by timestamp ascending
    const sorted = [...autoLogs].sort((a, b) => a.timestamp - b.timestamp);
    const blocks = [];
    let currentBlock = null;

    sorted.forEach((log) => {
      const cleaned = cleanTitle(log.title);
      if (!currentBlock) {
        currentBlock = {
          id: uid(),
          app: log.app,
          category: log.category,
          title: cleaned,
          titles: cleaned ? [cleaned] : [],
          startTimestamp: log.timestamp,
          endTimestamp: log.timestamp,
          duration: 10, // 10 second polls
          date: new Date(log.timestamp * 1000).toISOString().slice(0, 10),
        };
        return;
      }

      const gap = log.timestamp - currentBlock.endTimestamp;
      const sameApp = log.app === currentBlock.app;
      const sameCategory = log.category === currentBlock.category;

      // Allow a gap of up to 120 seconds (2 minutes) to merge logs
      if (sameApp && sameCategory && gap <= 120) {
        currentBlock.endTimestamp = log.timestamp;
        currentBlock.duration += 10;
        if (cleaned && !currentBlock.titles.includes(cleaned)) {
          currentBlock.titles.push(cleaned);
        }
      } else {
        blocks.push(currentBlock);
        currentBlock = {
          id: uid(),
          app: log.app,
          category: log.category,
          title: cleaned,
          titles: cleaned ? [cleaned] : [],
          startTimestamp: log.timestamp,
          endTimestamp: log.timestamp,
          duration: 10,
          date: new Date(log.timestamp * 1000).toISOString().slice(0, 10),
        };
      }
    });

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // Sort by start timestamp descending (newest first)
    return blocks.sort((a, b) => b.startTimestamp - a.startTimestamp);
  }, [autoLogs]);

  // Click-to-log autofill
  const handleLogBlock = (block) => {
    const formatTime = (ts) => {
      const date = new Date(ts * 1000);
      const h = String(date.getHours()).padStart(2, "0");
      const m = String(date.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    };

    setAdding(true);
    setView("today");
    
    // Guess short title
    let shortTitle = block.title.split(" - ").slice(-1)[0] || block.app;
    if (shortTitle.length > 50) shortTitle = block.app;

    setPrefillData({
      title: `${block.category}: ${shortTitle}`,
      start: formatTime(block.startTimestamp),
      end: formatTime(block.endTimestamp + 10),
      priority: "medium",
      tags: TAGS.includes(block.category) ? [block.category] : [],
    });
  };

  /* ── analytics calculations filtered by range ── */
  const rangeLimitDate = useMemo(() => {
    const d = new Date();
    if (range === "7d") d.setDate(d.getDate() - 7);
    else if (range === "30d") d.setDate(d.getDate() - 30);
    else return null;
    return d.toISOString().slice(0, 10);
  }, [range]);

  const filteredTasks = useMemo(() => {
    if (!rangeLimitDate) return tasks;
    return tasks.filter((t) => t.date >= rangeLimitDate || (t.completedDate && t.completedDate >= rangeLimitDate));
  }, [tasks, rangeLimitDate]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completedTasks = filteredTasks.filter((t) => t.status === "completed");
    const completed = completedTasks.length;
    const pending = total - completed;
    
    // Focus hours
    const mins = filteredTasks.reduce((s, t) => s + minutesBetween(t.start, t.end), 0);
    
    // Today stats
    const todayMins = today.reduce((s, t) => s + minutesBetween(t.start, t.end), 0);
    const doneToday = done.filter((t) => t.completedDate === todayISO()).length;
    const totalToday = today.length + doneToday;
    const pct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

    // Focus streak (always calculated on full history)
    const streak = calculateStreak(tasks);

    return {
      pct, doneToday, totalToday, todayMins, mins,
      total, completed, pending, streak
    };
  }, [filteredTasks, tasks, today, done]);

  /* ── donut priority breakdown data ── */
  const priorityData = useMemo(() => {
    return Object.keys(PRIORITIES).map((key) => ({
      key,
      label: PRIORITIES[key].label,
      color: PRIORITIES[key].c,
      count: filteredTasks.filter((t) => t.priority === key).length
    }));
  }, [filteredTasks]);

  /* ── line chart trend (completed tasks count per day) ── */
  const trendData = useMemo(() => {
    const numDays = range === "all" ? 7 : range === "30d" ? 30 : 7;
    return Array.from({ length: numDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (numDays - 1 - i));
      const iso = d.toISOString().slice(0, 10);
      const count = done.filter((t) => t.completedDate === iso).length;
      return {
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        val: count
      };
    });
  }, [done, range]);

  /* ── focus breakdown by tags ── */
  const tagMins = useMemo(() => {
    const m = {};
    filteredTasks.forEach((t) => {
      const d = minutesBetween(t.start, t.end);
      (t.tags || []).forEach((tag) => { m[tag] = (m[tag] || 0) + d; });
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredTasks]);

  /* ── grouped completions for "completed" list ── */
  const byDate = useMemo(() => {
    const m = {};
    done.forEach((t) => { (m[t.completedDate] ||= []).push(t); });
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]));
  }, [done]);

  /* ── search results ── */
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    return tasks.filter((t) =>
      [t.title, t.planned, t.done, ...(t.tags || [])].join(" ").toLowerCase().includes(s)
    );
  }, [q, tasks]);

  const complete = (id) => persist(tasks.map((t) =>
    t.id === id ? { ...t, status: "completed", progress: 100, completedDate: todayISO(), completedAt: Date.now() } : t
  ));

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `flowtrack-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJSON = (file) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const incoming = JSON.parse(r.result);
        if (!Array.isArray(incoming)) throw new Error("not an array");
        const ids = new Set(tasks.map((t) => t.id));
        persist([...tasks, ...incoming.filter((t) => t && t.id && !ids.has(t.id))]);
      } catch {
        alert("That file isn't a FlowTrack export.");
      }
    };
    r.readAsText(file);
  };

  const NAV = [
    { k: "today", label: "Today", Icon: LayoutGrid },
    { k: "completed", label: "Completed", Icon: CheckCircle2 },
    { k: "dashboard", label: "Dashboard", Icon: BarChart3 },
    { k: "calendar", label: "Calendar", Icon: CalIcon },
    { k: "search", label: "Search", Icon: SearchIcon },
  ];

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "grid", placeItems: "center", color: C.dim, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Loader2 size={16} className="anim-rotate" color={C.amber} />
          Loading your space…
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: C.txt, display: "flex",
    }}>
      {/* ── sidebar ── */}
      <aside style={{
        width: 218, borderRight: `1px solid ${C.border}`, padding: 22, flexShrink: 0,
        display: "flex",
        position: "sticky", top: 0, height: "100vh",
        flexDirection: "column",
        background: "rgba(10, 11, 16, 0.4)",
        backdropFilter: "blur(20px)",
        zIndex: 10,
      }} className={`ft-side${navOpen ? "" : " ft-closed"}`}>
        
        {/* logo */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em", color: C.txt }}>FlowTrack</div>
          <div style={{ fontSize: 10, color: C.dim, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 3, fontWeight: 500 }}>
            Plan · Execute · Reflect
          </div>
        </div>

        {/* nav */}
        <nav style={{ display: "grid", gap: 4 }}>
          {NAV.map(({ k, label, Icon }) => (
            <button key={k} className="nav-btn" onClick={() => { setView(k); setNavOpen(false); }} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
              background: view === k ? "rgba(255,255,255,0.03)" : "transparent",
              border: `1px solid ${view === k ? C.border : "transparent"}`, borderRadius: 8, cursor: "pointer",
              color: view === k ? C.txt : C.dim, fontSize: 13, textAlign: "left",
              width: "100%", fontFamily: "inherit", fontWeight: view === k ? 500 : 400,
            }}>
              <Icon size={14.5} color={view === k ? C.amber : C.dim} /> {label}
            </button>
          ))}
        </nav>

        {/* export / import */}
        <div style={{ marginTop: "auto" }}>
          
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button onClick={exportJSON} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "transparent", border: `1px solid ${C.border}`, color: C.dim,
              borderRadius: 8, padding: "7px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}>
              <Download size={12} /> Export
            </button>
            <button onClick={() => impRef.current?.click()} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "transparent", border: `1px solid ${C.border}`, color: C.dim,
              borderRadius: 8, padding: "7px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}>
              <Upload size={12} /> Import
            </button>
          </div>
          <input ref={impRef} type="file" accept="application/json" hidden
            onChange={(e) => e.target.files[0] && importJSON(e.target.files[0])} />

          {/* user profile display card */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.amber}, #EF4444)`,
              display: "grid", placeItems: "center", color: "#000", fontWeight: 700, fontSize: 13,
            }}>
              {username[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
              {isEditingName ? (
                <input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  autoFocus
                  style={{
                    background: C.panelElevated,
                    border: `1px solid ${C.amber}`,
                    borderRadius: 4,
                    padding: "2px 4px",
                    fontSize: 12,
                    color: C.txt,
                    width: "100%",
                    outline: "none",
                  }}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {username}
                  </span>
                  <button onClick={() => setIsEditingName(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}>
                    <Edit2 size={10} color={C.dim} />
                  </button>
                </div>
              )}
              <div style={{ fontSize: 9.5, color: C.dim }}>Task Partner</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── main space ── */}
      <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 64px", maxWidth: 960 }}>
        
        {/* mobile burger */}
        <button onClick={() => setNavOpen(!navOpen)} className="ft-burger" style={{
          display: "none", background: "transparent", border: `1px solid ${C.border}`,
          color: C.dim, borderRadius: 8, padding: 8, marginBottom: 16, cursor: "pointer",
        }}>
          <Menu size={16} />
        </button>

        {/* ── Today view ── */}
        {view === "today" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10.5, color: C.dim, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>
                {fmtDate(todayISO())}
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 20px", letterSpacing: "-.02em", color: C.txt }}>
                {getGreeting()}, <span style={{
                  background: `linear-gradient(135deg, ${C.amber}, #F59E0B)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 800,
                }}>{username}</span>
              </h1>
              <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 20px" }}>
                <div style={{ flex: "1 1 240px", minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.dim, marginBottom: 7 }}>
                    <span>Progress: <strong>{stats.doneToday}</strong> of <strong>{stats.totalToday}</strong> completed</span>
                    <span style={{ color: C.amber, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{stats.pct}%</span>
                  </div>
                  <Bar pct={stats.pct} />
                </div>
                <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {fmtDur(stats.todayMins)}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Logged time</div>
                  </div>
                  {stats.streak > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: 8, padding: "6px 12px" }}>
                      <Flame size={16} color="#EF4444" style={{ filter: "drop-shadow(0 0 4px rgba(239,68,68,0.4))" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444" }}>{stats.streak} Days</div>
                        <div style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: "0.03em" }}>Focus Streak</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {adding
                ? <NewTask prefill={prefillData} onAdd={(t) => { persist([...tasks, t]); setAdding(false); setPrefillData(null); }} onCancel={() => { setAdding(false); setPrefillData(null); }} />
                : <button onClick={() => setAdding(true)} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "rgba(255,255,255,0.01)", border: `1px dashed ${C.border}`, color: C.dim,
                    borderRadius: 12, padding: 14, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s ease",
                  }}>
                    <Plus size={15} /> New Task
                  </button>
              }
              {today.map((t) => (
                <TaskCard key={t.id} task={t}
                  onUpdate={(u) => persist(tasks.map((x) => (x.id === u.id ? u : x)))}
                  onDelete={(id) => persist(tasks.filter((x) => x.id !== id))}
                  onComplete={complete} />
              ))}
              {today.length === 0 && !adding && (
                <div style={{ textAlign: "center", padding: "64px 20px", color: C.dim, fontSize: 13.5, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16 }}>
                  No active tasks planned. Add your first goal to get started!
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Completed view ── */}
        {view === "completed" && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-.02em", color: C.txt }}>Completed Logs</h1>
            {byDate.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 20px", color: C.dim, fontSize: 13.5, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16 }}>
                Completed tasks will be saved and grouped here chronologically.
              </div>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              {byDate.map(([d, list]) => (
                <div key={d} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", backdropFilter: "blur(12px)" }}>
                  <div onClick={() => setOpenDate(openDate === d ? null : d)} style={{
                    padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    {openDate === d ? <ChevronDown size={14} color={C.dim} /> : <ChevronRight size={14} color={C.dim} />}
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 80, color: C.txt }}>{fmtShort(d)}</span>
                    <span style={{ fontSize: 12, color: C.dim, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {list.map((t) => t.title).join(" · ")}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.green + "11", border: `1px solid ${C.green}22`, borderRadius: 6, padding: "2px 7px" }}>{list.length}</span>
                  </div>
                  {openDate === d && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: 18, display: "grid", gap: 14, background: "rgba(0,0,0,0.1)" }}>
                      {list.map((t) => (
                        <div key={t.id} style={{ background: "rgba(255,255,255,0.015)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.txt }}>{t.title}</span>
                            {t.start && <span style={{ fontSize: 11, color: C.dim }}>{t.start} → {t.end}</span>}
                            {(t.tags || []).map((tg) => (
                              <span key={tg} style={{ fontSize: 10, color: C.dim, background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "1px 6px" }}>{tg}</span>
                            ))}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                            <div>
                              <div style={{ fontSize: 9.5, color: C.dim, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5, fontWeight: 500 }}>Planned</div>
                              <div style={{ fontSize: 12.5, color: C.dim, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{t.planned || "—"}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9.5, color: C.dim, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5, fontWeight: 500 }}>Actually done</div>
                              <div style={{ fontSize: 12.5, color: C.txt, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{t.done || "—"}</div>
                            </div>
                          </div>
                          {(t.files || []).length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                              {t.files.map((f) => (
                                <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.dim, background: C.panelElevated, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px" }}>
                                  <FileText size={10} /> {f.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Upgraded insightful dashboard view ── */}
        {view === "dashboard" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-.02em", color: C.txt }}>Space Analytics</h1>
                <p style={{ fontSize: 12, color: C.dim, margin: "4px 0 0" }}>Interactive stats for <strong>{username}</strong></p>
              </div>

              {/* Subtabs and Range selector */}
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {/* View switcher */}
                <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
                  <button onClick={() => setDashTab("overview")} style={{
                    background: dashTab === "overview" ? "rgba(255,255,255,0.06)" : "transparent",
                    border: "none", borderRadius: 7, color: dashTab === "overview" ? C.txt : C.dim,
                    fontSize: 11.5, fontWeight: 600, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit",
                  }}>Overview</button>
                  <button onClick={() => setDashTab("auto")} style={{
                    background: dashTab === "auto" ? "rgba(255,255,255,0.06)" : "transparent",
                    border: "none", borderRadius: 7, color: dashTab === "auto" ? C.txt : C.dim,
                    fontSize: 11.5, fontWeight: 600, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    Auto Activity 
                    {trackerStatus === "active" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />}
                  </button>
                </div>

                {dashTab === "overview" && (
                  <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
                    {[
                      ["7d", "7 Days"],
                      ["30d", "30 Days"],
                      ["all", "All Time"]
                    ].map(([k, label]) => (
                      <button key={k} onClick={() => setRange(k)} style={{
                        background: range === k ? "rgba(255,255,255,0.06)" : "transparent",
                        border: "none", borderRadius: 7, color: range === k ? C.txt : C.dim,
                        fontSize: 11.5, fontWeight: 600, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit",
                        transition: "all 0.15s ease",
                      }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TAB 1: Analytics Overview */}
            {dashTab === "overview" && (
              <>
                {/* Grid metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 20 }}>
                  {[
                    ["Tasks tracked", stats.total, C.txt, "total"],
                    ["Completed", stats.completed, C.green, "completed"],
                    ["Completion rate", `${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%`, C.amber, "rate"],
                    ["Focused time", fmtDur(stats.mins), C.blue, "time"],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{
                      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, backdropFilter: "blur(12px)",
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                      <div style={{ fontSize: 11.5, color: C.dim, marginTop: 4, fontWeight: 500 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 20 }}>
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, backdropFilter: "blur(12px)", display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 16, color: C.txt }}>Completion Trend</div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                      <SVGLinesChart data={trendData} color={C.amber} label="Tasks completed" />
                    </div>
                  </div>

                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, backdropFilter: "blur(12px)", display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 16, color: C.txt }}>Priority Split</div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                      <SVGPieChart data={priorityData} />
                    </div>
                  </div>
                </div>

                {/* Tag Time Distribution */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 20, backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 16, color: C.txt }}>Time Distribution by Tags</div>
                  {tagMins.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: C.dim, padding: "10px 0" }}>Create tasks with tags and input time details to generate analytical charts.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {tagMins.map(([tag, m]) => (
                        <div key={tag}>
                          <div style={{ display: "flex", justifycontent: "space-between", fontSize: 12, color: C.dim, marginBottom: 5 }}>
                            <span style={{ fontWeight: 500, color: C.txt }}>{tag}</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", color: C.dim }}>{fmtDur(m)}</span>
                          </div>
                          <Bar pct={(m / tagMins[0][1]) * 100} color={C.blue} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity heatmap */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, backdropFilter: "blur(12px)" }}>
                  <div style={{ display: "flex", justifycontent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.txt }}>Activity Grid</div>
                    <div style={{ display: "flex", gap: 8, fontSize: 9.5, color: C.dim, alignItems: "center" }}>
                      <span>Less</span>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.04)" }} />
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: C.amber + "33" }} />
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: C.amber + "aa" }} />
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: C.amber }} />
                      <span>More</span>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ display: "flex", gap: 3, paddingBottom: 6 }}>
                      {Array.from({ length: 84 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (83 - i));
                        const iso = d.toISOString().slice(0, 10);
                        const n = done.filter((t) => t.completedDate === iso).length;
                        const bg = n === 0 ? "rgba(255,255,255,0.04)" : n === 1 ? C.amber + "33" : n <= 3 ? C.amber + "aa" : C.amber;
                        return (
                          <div key={i} title={`${iso}: ${n} tasks completed`} style={{
                            width: 10, height: 10, borderRadius: 2, background: bg, flexShrink: 0,
                            transition: "transform 0.15s ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.25)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1.0)"; }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifycontent: "space-between", fontSize: 10, color: C.dim, marginTop: 6, padding: "0 2px" }}>
                    <span>12 Weeks Ago</span>
                    <span>Today</span>
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: Auto Desktop Activity */}
            {dashTab === "auto" && (
              <div style={{ display: "grid", gap: 20 }}>
                {/* Connection Status Card */}
                <div style={{
                  background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 24px",
                  display: "flex", alignItems: "center", justifycontent: "space-between", flexWrap: "wrap", gap: 14,
                  backdropFilter: "blur(12px)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
                      display: "grid", placeItems: "center", color: C.amber
                    }}>
                      <Monitor size={18} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: trackerStatus === "active" ? C.green : trackerStatus === "paused" ? C.amber : "#555",
                          boxShadow: trackerStatus === "active" ? `0 0 10px ${C.green}` : trackerStatus === "paused" ? `0 0 10px ${C.amber}` : "none",
                        }} />
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: C.txt }}>
                          {trackerStatus === "active" ? "Auto-Tracking Active" : trackerStatus === "paused" ? "Auto-Tracking Paused" : "Auto-Tracker Offline"}
                        </span>
                      </div>
                      <p style={{ fontSize: 11.5, color: C.dim, margin: "3px 0 0" }}>
                        {trackerStatus === "offline" 
                          ? "Run python tracker.py on your machine to sync screen time logs." 
                          : "Automatically capturing your active desktop windows in real-time."}
                      </p>
                    </div>
                  </div>

                  {trackerStatus !== "offline" && (
                    <button onClick={toggleTracker} style={{
                      background: trackerStatus === "active" ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                      border: `1px solid ${trackerStatus === "active" ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)"}`,
                      color: trackerStatus === "active" ? C.red : C.green,
                      borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
                      transition: "all 0.15s ease",
                    }}>
                      {trackerStatus === "active" ? (
                        <>
                          <Pause size={13} fill="currentColor" /> Pause Tracking
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" /> Start Tracking
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Aggregated Blocks Timeline */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, backdropFilter: "blur(12px)" }}>
                  <div style={{ display: "flex", justifycontent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: C.txt, margin: 0 }}>Activity Timeline</h3>
                    {autoLogs.length > 0 && (
                      <button onClick={clearAutoLogs} style={{
                        background: "transparent", border: "none", color: C.red, fontSize: 11.5, cursor: "pointer",
                        fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 4
                      }}>
                        <Trash2 size={12} /> Clear Logs
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    {aggregatedBlocks.map((block) => {
                      const startTimeStr = new Date(block.startTimestamp * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      const endTimeStr = new Date(block.endTimestamp * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      
                      return (
                        <div key={block.id} className="task-card" style={{
                          background: "rgba(255,255,255,0.01)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px",
                          display: "flex", alignItems: "center", justifycontent: "space-between", gap: 14
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: "50%",
                              background: block.category === "Coding" ? C.amber + "11" : block.category === "Research" ? C.blue + "11" : "rgba(255,255,255,0.02)",
                              border: `1px solid ${block.category === "Coding" ? C.amber + "22" : block.category === "Research" ? C.blue + "22" : C.border}`,
                              display: "grid", placeItems: "center", color: block.category === "Coding" ? C.amber : block.category === "Research" ? C.blue : C.dim,
                              flexShrink: 0
                            }}>
                              <Clock size={16} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.txt }}>{block.category}</span>
                                <span style={{ fontSize: 11, color: C.dim }}>{block.app}</span>
                              </div>
                              {block.titles && block.titles.length > 1 ? (
                                <div style={{ display: "grid", gap: 4, marginTop: 6, paddingLeft: 8, borderLeft: `2px solid ${C.border}` }}>
                                  {block.titles.map((title, idx) => (
                                    <div key={idx} style={{ fontSize: 11.5, color: C.dim, display: "flex", gap: 6, alignItems: "center" }}>
                                      <span style={{ color: C.amber, fontSize: 8 }}>•</span>
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={title}>
                                        {title}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {block.title}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{fmtSeconds(block.duration)}</div>
                              <div style={{ fontSize: 10, color: C.dim2, marginTop: 2 }}>{startTimeStr} - {endTimeStr}</div>
                            </div>

                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => deleteAutoBlock(block)} style={{
                                background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 8,
                                color: C.dim, cursor: "pointer", display: "flex", transition: "all 0.15s ease",
                              }}>
                                <Trash2 size={13} />
                              </button>
                              <button onClick={() => handleLogBlock(block)} style={{
                                background: C.amber, border: "none", borderRadius: 8, padding: "8px 14px",
                                color: "#000", fontSize: 12, fontWeight: 600, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                                transition: "all 0.15s ease",
                              }}>
                                <Plus size={12} strokeWidth={2.5} /> Log Block
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {aggregatedBlocks.length === 0 && (
                      <div style={{ textAlign: "center", padding: "48px 20px", color: C.dim2, fontSize: 13 }}>
                        {trackerStatus === "offline" 
                          ? "Desktop Tracker is offline. Start the Python script to log window activity."
                          : "No activity logged yet. Spend some time working on apps/websites!"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Calendar view ── */}
        {view === "calendar" && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-.02em", color: C.txt }}>Calendar Logs</h1>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, backdropFilter: "blur(12px)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 11, color: C.dim, paddingBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>
                ))}
                {(() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                  const cells = [];
                  for (let i = 0; i < first.getDay(); i++) cells.push(<div key={"b" + i} />);
                  for (let d = 1; d <= days; d++) {
                    const iso = new Date(now.getFullYear(), now.getMonth(), d).toLocaleDateString("en-CA");
                    const n = done.filter((t) => t.completedDate === iso).length;
                    const isToday = iso === todayISO();
                    cells.push(
                      <button key={d} onClick={() => { setView("completed"); setOpenDate(iso); }} style={{
                        aspectRatio: "1", background: isToday ? "rgba(255,255,255,0.03)" : "transparent",
                        border: `1px solid ${isToday ? C.amber : C.border}`, borderRadius: 10,
                        color: C.txt, fontSize: 13, cursor: "pointer", display: "grid",
                        placeItems: "center", position: "relative", fontFamily: "inherit",
                        fontVariantNumeric: "tabular-nums", transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.amber;
                        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isToday ? C.amber : C.border;
                        e.currentTarget.style.background = isToday ? "rgba(255,255,255,0.03)" : "transparent";
                      }}
                      >
                        {d}
                        {n > 0 && <div style={{ position: "absolute", bottom: 6, width: 5, height: 5, borderRadius: "50%", background: C.green }} />}
                      </button>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>
          </>
        )}

        {/* ── Search view ── */}
        {view === "search" && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 20px", letterSpacing: "-.02em", color: C.txt }}>Search Space</h1>
            <div style={{ position: "relative", marginBottom: 18 }}>
              <input autoFocus style={{ ...inputS, padding: "14px 16px 14px 44px", fontSize: 14.5, background: C.panel, border: `1px solid ${C.border}` }}
                placeholder="Search task titles, logs, reflections, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
              <SearchIcon size={16} color={C.dim} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {results.map((t) => (
                <div key={t.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, backdropFilter: "blur(12px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.txt }}>{t.title}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 500, color: STATUSES[t.status].c, background: STATUSES[t.status].c + "11", border: `1px solid ${STATUSES[t.status].c}22`, borderRadius: 5, padding: "2px 7px" }}>{STATUSES[t.status].label}</span>
                    <span style={{ fontSize: 11, color: C.dim, marginLeft: "auto" }}>
                      {fmtShort(t.completedDate || t.date)}
                    </span>
                  </div>
                  {(t.done || t.planned) && (
                    <div style={{ fontSize: 12.5, color: C.dim, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(t.done || t.planned).slice(0, 120)}
                    </div>
                  )}
                </div>
              ))}
              {q && results.length === 0 && (
                <div style={{ textAlign: "center", padding: 48, color: C.dim, fontSize: 13.5, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16 }}>
                  No records match "{q}".
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }
        input[type=time]::-webkit-calendar-picker-indicator { filter: invert(.8); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        
        input:focus, select:focus, textarea:focus {
          border-color: ${C.amber} !important;
          background: rgba(255, 255, 255, 0.04) !important;
          box-shadow: 0 0 0 1px ${C.amber}11;
        }

        .nav-btn:hover {
          background: rgba(255,255,255,0.02) !important;
          color: ${C.txt} !important;
        }

        .task-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .task-card:hover {
          border-color: rgba(255, 172, 51, 0.15) !important;
          box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        }

        .anim-rotate {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 720px) {
          .ft-side { position: fixed; z-index: 20; background: ${C.bg}; }
          .ft-side.ft-closed { display: none !important; }
          .ft-burger { display: block !important; }
        }
      `}</style>
    </div>
  );
}
