import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Calendar as CalIcon, LayoutGrid, CheckCircle2, Search as SearchIcon,
  BarChart3, ChevronDown, ChevronRight, Paperclip, X, Trash2, Clock,
  Check, Circle, PauseCircle, Loader2, FileText, Menu, Download, Upload
} from "lucide-react";

/* ── keys ── */
const K_TASKS = "ft:tasks:v1";

/* ── palette: ink + graphite + a single signal amber ── */
const C = {
  bg: "#0E0F12",
  panel: "#16181D",
  panel2: "#1C1F26",
  line: "#282C35",
  line2: "#343946",
  txt: "#E8E9EC",
  dim: "#9095A1",
  dim2: "#646A78",
  amber: "#E8A33D",
  amberDim: "#8A6224",
  green: "#4FA97A",
  red: "#D2564B",
  blue: "#5B87C9",
};

const PRIORITIES = {
  critical: { label: "Critical", c: C.red },
  high: { label: "High", c: C.amber },
  medium: { label: "Medium", c: C.blue },
  low: { label: "Low", c: C.dim2 },
};

const STATUSES = {
  not_started: { label: "Not started", c: C.dim2, Icon: Circle },
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

/* ── small pieces ── */
function Pill({ children, color, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color + "22" : "transparent",
        border: `1px solid ${active ? color : C.line2}`,
        color: active ? color : C.dim,
        borderRadius: 999, padding: "3px 10px", fontSize: 11.5,
        cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Bar({ pct, color = C.amber }) {
  return (
    <div style={{ height: 4, background: C.line, borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .35s ease" }} />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: C.dim2, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputS = {
  background: C.bg, border: `1px solid ${C.line2}`, color: C.txt,
  borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", outline: "none",
  fontFamily: "inherit",
};

/* ── task card ── */
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
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}
      >
        {open ? <ChevronDown size={15} color={C.dim2} /> : <ChevronRight size={15} color={C.dim2} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 500, color: C.txt }}>{task.title}</span>
            <span style={{ fontSize: 11, color: P.c, border: `1px solid ${P.c}55`, borderRadius: 4, padding: "1px 6px" }}>
              {P.label}
            </span>
            {(task.tags || []).map((t) => (
              <span key={t} style={{ fontSize: 10.5, color: C.dim2, background: C.panel2, borderRadius: 4, padding: "1px 6px" }}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5, color: C.dim }}>
            {task.start && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={11} /> {task.start} → {task.end || "—"}
              </span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: S.c }}>
              <S.Icon size={11} /> {S.label}
            </span>
            {(task.files || []).length > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Paperclip size={11} /> {task.files.length}
              </span>
            )}
          </div>
        </div>
        <div style={{ width: 84, textAlign: "right" }}>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 5, fontVariantNumeric: "tabular-nums" }}>
            {task.progress}%
          </div>
          <Bar pct={task.progress} color={task.status === "blocked" ? C.red : C.amber} />
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.line}`, padding: 16, display: "grid", gap: 16 }}>
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
                  <option key={k} value={k} style={{ background: C.panel }}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select style={inputS} value={task.priority}
                onChange={(e) => onUpdate({ ...task, priority: e.target.value })}>
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k} style={{ background: C.panel }}>{v.label}</option>
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
                border: `1px dashed ${C.line2}`, borderRadius: 8, padding: 14,
                textAlign: "center", color: C.dim2, fontSize: 12, cursor: "pointer",
              }}
            >
              Drop files here, or click to attach
            </div>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            {(task.files || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {task.files.map((f) => (
                  <span key={f.id} style={{
                    display: "flex", alignItems: "center", gap: 6, background: C.panel2,
                    border: `1px solid ${C.line2}`, borderRadius: 6, padding: "4px 8px", fontSize: 11.5, color: C.dim,
                  }}>
                    <FileText size={11} /> {f.name}
                    <X size={11} style={{ cursor: "pointer" }}
                      onClick={() => onUpdate({ ...task, files: task.files.filter((x) => x.id !== f.id) })} />
                  </span>
                ))}
              </div>
            )}
          </Field>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button onClick={() => onDelete(task.id)} style={{
              background: "transparent", border: `1px solid ${C.line2}`, color: C.dim,
              borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
            }}>
              <Trash2 size={13} /> Delete
            </button>
            <button onClick={() => onComplete(task.id)} style={{
              background: C.green, border: "none", color: "#0B1A12", fontWeight: 500,
              borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
            }}>
              <Check size={13} /> Mark complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── new task form ── */
function NewTask({ onAdd, onCancel }) {
  const [t, setT] = useState({ title: "", start: "", end: "", priority: "medium", tags: [] });
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
    <div style={{ background: C.panel, border: `1px solid ${C.amberDim}`, borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
      <input autoFocus style={{ ...inputS, fontSize: 14.5 }} placeholder="What are you working on?"
        value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && submit()} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10 }}>
        <Field label="Start"><input type="time" style={inputS} value={t.start} onChange={(e) => setT({ ...t, start: e.target.value })} /></Field>
        <Field label="End"><input type="time" style={inputS} value={t.end} onChange={(e) => setT({ ...t, end: e.target.value })} /></Field>
        <Field label="Priority">
          <select style={inputS} value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value })}>
            {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k} style={{ background: C.panel }}>{v.label}</option>)}
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
        <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${C.line2}`, color: C.dim, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={submit} style={{ background: C.amber, border: "none", color: "#1A1204", fontWeight: 500, borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Add task</button>
      </div>
    </div>
  );
}

/* ── app ── */
export default function FlowTrack() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("today");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [openDate, setOpenDate] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const impRef = useRef(null);

  useEffect(() => { loadTasks().then((t) => { setTasks(t); setLoading(false); }); }, []);
  const persist = (next) => { setTasks(next); saveTasks(next); };

  const today = tasks.filter((t) => t.status !== "completed");
  const done = tasks.filter((t) => t.status === "completed");

  const stats = useMemo(() => {
    const mins = tasks.reduce((s, t) => s + minutesBetween(t.start, t.end), 0);
    const todayMins = today.reduce((s, t) => s + minutesBetween(t.start, t.end), 0);
    const doneToday = done.filter((t) => t.completedDate === todayISO()).length;
    const totalToday = today.length + doneToday;
    return {
      pct: totalToday ? Math.round((doneToday / totalToday) * 100) : 0,
      doneToday, totalToday, todayMins, mins,
      total: tasks.length, completed: done.length, pending: today.length,
    };
  }, [tasks, today, done]);

  const byDate = useMemo(() => {
    const m = {};
    done.forEach((t) => { (m[t.completedDate] ||= []).push(t); });
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]));
  }, [done]);

  const tagMins = useMemo(() => {
    const m = {};
    tasks.forEach((t) => {
      const d = minutesBetween(t.start, t.end);
      (t.tags || []).forEach((tag) => { m[tag] = (m[tag] || 0) + d; });
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [tasks]);

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
      <div style={{ background: C.bg, minHeight: "100vh", display: "grid", placeItems: "center", color: C.dim2, fontSize: 13 }}>
        Loading your work…
      </div>
    );
  }

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: C.txt, display: "flex",
      fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', sans-serif",
    }}>
      {/* sidebar */}
      <aside style={{
        width: 208, borderRight: `1px solid ${C.line}`, padding: 20, flexShrink: 0,
        display: "flex",
        position: "sticky", top: 0, height: "100vh",
        flexDirection: "column",
      }} className={`ft-side${navOpen ? "" : " ft-closed"}`}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-.01em" }}>FlowTrack</div>
          <div style={{ fontSize: 10.5, color: C.dim2, letterSpacing: ".1em", textTransform: "uppercase", marginTop: 3 }}>
            Plan · Execute · Reflect
          </div>
        </div>
        <nav style={{ display: "grid", gap: 2 }}>
          {NAV.map(({ k, label, Icon }) => (
            <button key={k} onClick={() => { setView(k); setNavOpen(false); }} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              background: view === k ? C.panel2 : "transparent",
              border: "none", borderRadius: 7, cursor: "pointer",
              color: view === k ? C.txt : C.dim, fontSize: 13, textAlign: "left",
              width: "100%", fontFamily: "inherit",
            }}>
              <Icon size={15} color={view === k ? C.amber : C.dim2} /> {label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button onClick={exportJSON} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "transparent", border: `1px solid ${C.line2}`, color: C.dim,
              borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>
              <Download size={12} /> Export
            </button>
            <button onClick={() => impRef.current?.click()} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "transparent", border: `1px solid ${C.line2}`, color: C.dim,
              borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>
              <Upload size={12} /> Import
            </button>
          </div>
          <input ref={impRef} type="file" accept="application/json" hidden
            onChange={(e) => e.target.files[0] && importJSON(e.target.files[0])} />
          <div style={{ fontSize: 9.5, color: C.dim2, lineHeight: 1.5 }}>
            Saved in this browser only. Export to back up or move devices.
          </div>
        </div>
      </aside>

      {/* main */}
      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 64px", maxWidth: 940 }}>
        <button onClick={() => setNavOpen(!navOpen)} className="ft-burger" style={{
          display: "none", background: "transparent", border: `1px solid ${C.line2}`,
          color: C.dim, borderRadius: 7, padding: 7, marginBottom: 14, cursor: "pointer",
        }}>
          <Menu size={16} />
        </button>

        {view === "today" && (
          <>
            <div style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 11, color: C.dim2, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
                {fmtDate(todayISO())}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 20px", letterSpacing: "-.02em" }}>
                Today's work
              </h1>
              <div style={{ display: "flex", gap: 32, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.dim, marginBottom: 7 }}>
                    <span>{stats.doneToday} of {stats.totalToday} done</span>
                    <span style={{ color: C.amber, fontVariantNumeric: "tabular-nums" }}>{stats.pct}%</span>
                  </div>
                  <Bar pct={stats.pct} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                    {fmtDur(stats.todayMins)}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim2 }}>scheduled</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {adding
                ? <NewTask onAdd={(t) => { persist([...tasks, t]); setAdding(false); }} onCancel={() => setAdding(false)} />
                : <button onClick={() => setAdding(true)} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: "transparent", border: `1px dashed ${C.line2}`, color: C.dim,
                    borderRadius: 10, padding: 13, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <Plus size={14} /> New task
                  </button>
              }
              {today.map((t) => (
                <TaskCard key={t.id} task={t}
                  onUpdate={(u) => persist(tasks.map((x) => (x.id === u.id ? u : x)))}
                  onDelete={(id) => persist(tasks.filter((x) => x.id !== id))}
                  onComplete={complete} />
              ))}
              {today.length === 0 && !adding && (
                <div style={{ textAlign: "center", padding: "48px 20px", color: C.dim2, fontSize: 13 }}>
                  Nothing planned yet. Add the first thing you'll work on.
                </div>
              )}
            </div>
          </>
        )}

        {view === "completed" && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 24px", letterSpacing: "-.02em" }}>Completed work</h1>
            {byDate.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 20px", color: C.dim2, fontSize: 13 }}>
                Finished tasks land here, grouped by the day you closed them.
              </div>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {byDate.map(([d, list]) => (
                <div key={d} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                  <div onClick={() => setOpenDate(openDate === d ? null : d)} style={{
                    padding: "13px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    {openDate === d ? <ChevronDown size={15} color={C.dim2} /> : <ChevronRight size={15} color={C.dim2} />}
                    <span style={{ fontSize: 14, fontWeight: 500, minWidth: 78 }}>{fmtShort(d)}</span>
                    <span style={{ fontSize: 12, color: C.dim, flex: 1 }}>
                      {list.map((t) => t.title).join(" · ")}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.green }}>{list.length}</span>
                  </div>
                  {openDate === d && (
                    <div style={{ borderTop: `1px solid ${C.line}`, padding: 16, display: "grid", gap: 14 }}>
                      {list.map((t) => (
                        <div key={t.id} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 9, padding: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t.title}</span>
                            {t.start && <span style={{ fontSize: 11, color: C.dim2 }}>{t.start} → {t.end}</span>}
                            {(t.tags || []).map((tg) => (
                              <span key={tg} style={{ fontSize: 10.5, color: C.dim2, background: C.panel2, borderRadius: 4, padding: "1px 6px" }}>{tg}</span>
                            ))}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                            <div>
                              <div style={{ fontSize: 10, color: C.dim2, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Planned</div>
                              <div style={{ fontSize: 12.5, color: C.dim, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{t.planned || "—"}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: C.dim2, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Actually done</div>
                              <div style={{ fontSize: 12.5, color: C.dim, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{t.done || "—"}</div>
                            </div>
                          </div>
                          {(t.files || []).length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                              {t.files.map((f) => (
                                <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.dim2, background: C.panel2, borderRadius: 5, padding: "3px 7px" }}>
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

        {view === "dashboard" && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 24px", letterSpacing: "-.02em" }}>Dashboard</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 28 }}>
              {[
                ["Total tasks", stats.total, C.txt],
                ["Completed", stats.completed, C.green],
                ["Pending", stats.pending, C.amber],
                ["Hours logged", fmtDur(stats.mins), C.txt],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 11, padding: 16 }}>
                  <div style={{ fontSize: 22, fontWeight: 500, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  <div style={{ fontSize: 11, color: C.dim2, marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Time by tag</div>
              {tagMins.length === 0
                ? <div style={{ fontSize: 12, color: C.dim2 }}>Tag your tasks and schedule times to see where hours go.</div>
                : <div style={{ display: "grid", gap: 11 }}>
                    {tagMins.map(([tag, m]) => (
                      <div key={tag}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.dim, marginBottom: 5 }}>
                          <span>{tag}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDur(m)}</span>
                        </div>
                        <Bar pct={(m / tagMins[0][1]) * 100} />
                      </div>
                    ))}
                  </div>
              }
            </div>

            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Last 12 weeks</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {Array.from({ length: 84 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (83 - i));
                  const iso = d.toISOString().slice(0, 10);
                  const n = done.filter((t) => t.completedDate === iso).length;
                  const bg = n === 0 ? C.line : n === 1 ? C.amberDim : n <= 3 ? "#B8801F" : C.amber;
                  return <div key={i} title={`${iso} — ${n} completed`} style={{ width: 11, height: 11, borderRadius: 2, background: bg }} />;
                })}
              </div>
            </div>
          </>
        )}

        {view === "calendar" && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 24px", letterSpacing: "-.02em" }}>Calendar</h1>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 10.5, color: C.dim2, paddingBottom: 6 }}>{d}</div>
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
                        aspectRatio: "1", background: isToday ? C.panel2 : "transparent",
                        border: `1px solid ${isToday ? C.amberDim : C.line}`, borderRadius: 7,
                        color: C.txt, fontSize: 12, cursor: "pointer", display: "grid",
                        placeItems: "center", position: "relative", fontFamily: "inherit",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {d}
                        {n > 0 && <div style={{ position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: 999, background: C.green }} />}
                      </button>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>
          </>
        )}

        {view === "search" && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 20px", letterSpacing: "-.02em" }}>Search</h1>
            <input autoFocus style={{ ...inputS, padding: 12, fontSize: 14, marginBottom: 16 }}
              placeholder="Search titles, plans, notes, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div style={{ display: "grid", gap: 8 }}>
              {results.map((t) => (
                <div key={t.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t.title}</span>
                    <span style={{ fontSize: 11, color: STATUSES[t.status].c }}>{STATUSES[t.status].label}</span>
                    <span style={{ fontSize: 11, color: C.dim2, marginLeft: "auto" }}>
                      {fmtShort(t.completedDate || t.date)}
                    </span>
                  </div>
                  {(t.done || t.planned) && (
                    <div style={{ fontSize: 12, color: C.dim2, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(t.done || t.planned).slice(0, 120)}
                    </div>
                  )}
                </div>
              ))}
              {q && results.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.dim2, fontSize: 13 }}>
                  No matches for "{q}".
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }
        input[type=time]::-webkit-calendar-picker-indicator { filter: invert(.6); }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.line2}; border-radius: 4px; }
        @media (max-width: 720px) {
          .ft-side { position: fixed; z-index: 20; background: ${C.panel}; }
          .ft-side.ft-closed { display: none !important; }
          .ft-burger { display: block !important; }
        }
      `}</style>
    </div>
  );
}
