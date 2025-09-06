import React, { useEffect, useMemo, useState } from "react";



const LS_KEYS = {
  USERS: "apollogs.users:v1",
  SESS: "apollogs.session:v1",
  DATA: "apollogs.data:v1",
};

const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i); return (h >>> 0).toString(16); };
const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(f)); } catch { return f; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
function useLocalStorage(k, init) { const [s, setS] = useState(() => load(k, init)); useEffect(() => { save(k, s); }, [k, s]); return [s, setS]; }

// ---- Auth ----
function useAuth() {
  const [users, setUsers] = useLocalStorage(LS_KEYS.USERS, []);
  const [session, setSession] = useLocalStorage(LS_KEYS.SESS, null);

  const register = (email, pw) => {
    email = email.trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Please enter a valid email");
if ((pw || "").length < 6) throw new Error("Password must be at least 6 characters");
if (users.some(u => u.email === email)) throw new Error("This email is already registered");
    setUsers([...users, { email, passwordHash: hash(pw), createdAt: Date.now() }]);
    setSession({ email });
  };

  const login = (email, pw) => {
    email = email.trim().toLowerCase();
    const u = users.find(u => u.email === email);
if (!u || u.passwordHash !== hash(pw)) throw new Error("Incorrect email or password");
    setSession({ email });
  };

  return { session, register, login, logout: () => setSession(null) };
}


function useUserData(session) {
  const [all, setAll] = useLocalStorage(LS_KEYS.DATA, {});
  const email = session?.email;
  const data = useMemo(() => all[email] || { projects: [], tasks: {} }, [all, email]);
  const up = (fn) => setAll({ ...all, [email]: fn({ ...data }) });
  const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  // projects
  const createProject = (name) => up(d => { const id = newId(); d.projects.push({ id, name: (name || "").trim() || "Yeni Proje", createdAt: Date.now() }); d.tasks[id] = []; return d; });
  const renameProject = (id, name) => up(d => { const p = d.projects.find(p => p.id === id); if (p) p.name = (name || "").trim() || p.name; return d; });
  const deleteProject = (id) => up(d => { d.projects = d.projects.filter(p => p.id !== id); delete d.tasks[id]; return d; });

  // tasks
  const addTask = (pid, t) => up(d => { d.tasks[pid] ||= []; d.tasks[pid].push({ id: newId(), title: (t.title || "").trim(), notes: t.notes || "", due: t.due || "", priority: t.priority || "normal", done: false, createdAt: Date.now() }); return d; });
  const updateTask = (pid, tid, patch) => up(d => { d.tasks[pid] = (d.tasks[pid] || []).map(x => x.id === tid ? { ...x, ...patch } : x); return d; });
  const deleteTask = (pid, tid) => up(d => { d.tasks[pid] = (d.tasks[pid] || []).filter(x => x.id !== tid); return d; });

  return { data, createProject, renameProject, deleteProject, addTask, updateTask, deleteTask };
}

// ---- UI bits ----
function Auth({ onLogin, onRegister }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  const submit = () => { try { setErr(""); isLogin ? onLogin(email, pw) : onRegister(email, pw); } catch (e) { setErr(e.message); } };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#f8fafc" }}>
      <div style={{ width: 420, maxWidth: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 1px 2px rgba(0,0,0,.04)", padding: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>ApolloGS – To-Do</h1>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>{isLogin ? "Sign in" : "Create an account"}</div>
        <label style={{ fontSize: 12 }}>Email</label>
        <input style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", margin: "6px 0 10px" }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <label style={{ fontSize: 12 }}>Password</label>
        <input style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", margin: "6px 0 10px" }} type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
        {err && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit} style={{ flex: 1, background: "#111827", color: "#fff", borderRadius: 8, padding: "8px 12px" }}>{isLogin ? "Sign In" : "Sign Up"}</button>
          <button onClick={() => setIsLogin(!isLogin)} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }}>
            {isLogin ? "Create account" : "I already have an account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ projects, activeId, onSelect, onCreate, onRename, onDelete }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  return (
    <aside style={{ width: "100%", maxWidth: 384 }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Projects</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
          {creating ? (
            <>
              <input
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", height: 40, boxSizing: "border-box" }}
                placeholder="Project name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <button
                style={{ border: "1px solid #e5e7eb", borderRadius: 8, height: 40, padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap" }}
                onClick={() => { onCreate(name); setName(""); setCreating(false); }}
              >
                Save
              </button>
            </>
          ) : (
            <button
              style={{ gridColumn: "1 / span 2", border: "1px solid #e5e7eb", borderRadius: 8, height: 40, padding: "0 14px" }}
              onClick={() => setCreating(true)}
            >
              New Project
            </button>
          )}
        </div>

        <div>
          {projects.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "24px 0" }}>No projects</div>
          ) : projects.map(p => (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, cursor: "pointer", background: activeId === p.id ? "#f3f4f6" : "transparent", gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }} title={p.name}>
                {p.name}
              </div>
              <div style={{ display: "flex", gap: 8, opacity: 0.8 }}>
                <button
                  style={{ fontSize: 12, textDecoration: "underline" }}
                  onClick={(e) => { e.stopPropagation(); const n = prompt("New name", p.name); if (n) onRename(p.id, n); }}
                >
                  rename
                </button>
                <button
                  style={{ fontSize: 12, color: "#dc2626", textDecoration: "underline" }}
                  onClick={(e) => { e.stopPropagation(); if (confirm("Delete this project?")) onDelete(p.id); }}
                >
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}


function TaskBoard({ project, tasks, onAdd, onToggle, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("normal");

  const submit = () => { if (!title.trim()) return; onAdd({ title, notes, due, priority }); setTitle(""); setNotes(""); setDue(""); setPriority("normal"); };

  if (!project) return <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, flex: 1 }}>Select a project from the left</div>;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, flex: 1 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{project.name}</div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: 12 }}>
        <input style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <input style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }} type="date" value={due} onChange={e => setDue(e.target.value)} />
        <select style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }} value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit} style={{ flex: 1, background: "#111827", color: "#fff", borderRadius: 8, padding: "8px 12px" }}>Add</button>
          <button onClick={() => { const n = prompt("Notes", notes) || notes; setNotes(n); submit(); }} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }}>Add with note</button>
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {tasks.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "24px 0" }}>No tasks</div>
        ) : tasks.slice().sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "").localeCompare(b.due || "")).map(t => (
          <div key={t.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
              <input type="checkbox" checked={t.done} onChange={() => onToggle(t.id)} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, opacity: t.done ? 0.6 : 1, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 8 }}>
                  {t.due && <span>{t.due}</span>}
                  <span style={{ textTransform: "uppercase", fontSize: 10, border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 8px" }}>{t.priority}</span>
                </div>
                {t.notes && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{t.notes}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { const title = prompt("Title", t.title) || t.title; const due = prompt("Date (YYYY-MM-DD)", t.due || "") || t.due; const priority = prompt("Priority (low|normal|high)", t.priority) || t.priority; onUpdate(t.id, { title, due, priority }); }} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}>Edit</button>
              <button onClick={() => onDelete(t.id)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



export default function App() {
  const { session, register, login, logout } = useAuth();
  const { data, createProject, renameProject, deleteProject, addTask, updateTask, deleteTask } = useUserData(session);
  const [activeProjectId, setActiveProjectId] = useState(data.projects[0]?.id || null);

  useEffect(() => { if (!data.projects.find(p => p.id === activeProjectId)) setActiveProjectId(data.projects[0]?.id || null); }, [data.projects, activeProjectId]);

  if (!session?.email) return <Auth onLogin={login} onRegister={register} />;

  const active = data.projects.find(p => p.id === activeProjectId) || null;
  const tasks = active ? (data.tasks[active.id] || []) : [];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <header style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>ApolloGS – To-Do</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 12 }}>{session.email}</span>
<button onClick={logout} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}>
  Sign out
</button>
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: 16, display: "grid", gap: 16, gridTemplateColumns: "18rem 1fr" }}>
        <Sidebar
          projects={data.projects}
          activeId={activeProjectId}
          onSelect={setActiveProjectId}
          onCreate={(name) => createProject(name || "Yeni Proje")}
          onRename={renameProject}
          onDelete={(id) => { if (activeProjectId === id) setActiveProjectId(null); deleteProject(id); }}
        />
        <TaskBoard
          project={active}
          tasks={tasks}
          onAdd={(t) => addTask(active.id, t)}
          onToggle={(tid) => updateTask(active.id, tid, { done: !tasks.find(x => x.id === tid)?.done })}
          onUpdate={(tid, patch) => updateTask(active.id, tid, patch)}
          onDelete={(tid) => deleteTask(active.id, tid)}
        />
      </main>
    </div>
  );
}
