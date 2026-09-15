"use client"

import React, { useState, useEffect, useCallback } from "react"
import { exportExcel, exportCSV } from "@/lib/exportExcel"
import { removeDuplicates } from "@/lib/dedupe"
import { simulateEnumerator } from "@/lib/simulateEnumerator"

// ─── Theme ────────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState("light")
  useEffect(() => {
    const saved = localStorage.getItem("kf-theme") || "light"
    setTheme(saved)
    document.documentElement.setAttribute("data-theme", saved)
  }, [])
  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === "light" ? "dark" : "light"
      document.documentElement.setAttribute("data-theme", next)
      localStorage.setItem("kf-theme", next)
      return next
    })
  }, [])
  return { theme, toggle }
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const SunIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
const MoonIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
const SpinIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:"spin 0.8s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
const CheckIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const PlusIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const TrashIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
const EditIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const SaveIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
const EyeIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeOffIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_COLLECTION = 50

// ─── UI Primitives ────────────────────────────────────────────────────────────
function Badge({ children, variant = "default" }) {
  const s = {
    default: { bg:"var(--surface-2)",   color:"var(--text-muted)", border:"var(--border-sub)" },
    success: { bg:"var(--success-dim)", color:"var(--success)",    border:"transparent" },
    danger:  { bg:"var(--danger-dim)",  color:"var(--danger)",     border:"transparent" },
    accent:  { bg:"var(--accent-dim)",  color:"var(--accent)",     border:"transparent" },
    warning: { bg:"var(--warning-dim)", color:"var(--warning)",    border:"transparent" },
  }[variant] || {}
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.03em", fontFamily:"var(--font-mono)", background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      {children}
    </span>
  )
}

function Card({ children, style = {} }) {
  return (
    <div className="fade-up" style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", boxShadow:"var(--shadow-sm)", overflow:"hidden", ...style }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle, badge }) {
  return (
    <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--border-sub)", display:"flex", alignItems:"center", gap:10, background:"var(--surface-2)" }}>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:13, fontWeight:700, color:"var(--text)", margin:0 }}>{title}</h3>
          {badge}
        </div>
        {subtitle && <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:2, marginBottom:0 }}>{subtitle}</p>}
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <span style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:5 }}>
      {children}
    </span>
  )
}

function Input({ label, ...props }) {
  return (
    <label style={{ display:"flex", flexDirection:"column" }}>
      {label && <Label>{label}</Label>}
      <input
        {...props}
        style={{ padding:"8px 11px", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"var(--text)", fontSize:13, fontFamily:"var(--font-sans)", width:"100%", outline:"none", transition:"border-color var(--transition), box-shadow var(--transition)", ...props.style }}
        onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow="0 0 0 3px var(--accent-glow)"; props.onFocus?.(e) }}
        onBlur={e  => { e.target.style.borderColor="var(--border)";  e.target.style.boxShadow="none"; props.onBlur?.(e) }}
      />
    </label>
  )
}

function Select({ label, children, ...props }) {
  return (
    <label style={{ display:"flex", flexDirection:"column" }}>
      {label && <Label>{label}</Label>}
      <select
        {...props}
        style={{ padding:"8px 11px", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"var(--text)", fontSize:13, fontFamily:"var(--font-sans)", width:"100%", cursor:"pointer", appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237d8590' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", paddingRight:32, outline:"none", transition:"border-color var(--transition), box-shadow var(--transition)", ...props.style }}
        onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow="0 0 0 3px var(--accent-glow)"; props.onFocus?.(e) }}
        onBlur={e  => { e.target.style.borderColor="var(--border)";  e.target.style.boxShadow="none"; props.onBlur?.(e) }}
      >
        {children}
      </select>
    </label>
  )
}

function Btn({ children, variant="primary", loading=false, disabled=false, onClick, style={}, title="" }) {
  const v = {
    primary:   { bg:"var(--accent)",      color:"#fff",              border:"none" },
    secondary: { bg:"transparent",         color:"var(--text)",        border:"1px solid var(--border)" },
    ghost:     { bg:"transparent",         color:"var(--text-muted)", border:"1px solid transparent" },
    danger:    { bg:"var(--danger-dim)",   color:"var(--danger)",     border:"1px solid transparent" },
    success:   { bg:"var(--success)",      color:"#fff",              border:"none" },
    warning:   { bg:"var(--warning-dim)",  color:"var(--warning)",    border:"1px solid transparent" },
  }[variant] || {}
  const isOff = disabled && !loading
  return (
    <button onClick={onClick} disabled={disabled||loading} title={title}
      style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5, padding:"7px 14px", background:v.bg, color:v.color, border:v.border, borderRadius:"var(--radius-sm)", fontSize:12, fontWeight:600, fontFamily:"var(--font-sans)", cursor:(disabled||loading)?"not-allowed":"pointer", opacity:isOff?0.5:1, transition:"all var(--transition)", whiteSpace:"nowrap", ...style }}
      onMouseEnter={e => { if(!disabled&&!loading) e.currentTarget.style.opacity="0.82" }}
      onMouseLeave={e => { e.currentTarget.style.opacity=isOff?"0.5":"1" }}
    >
      {loading && <SpinIcon />}
      {children}
    </button>
  )
}

function Alert({ type="danger", children }) {
  const c = {
    danger:  { bg:"var(--danger-dim)",  color:"var(--danger)",  border:"var(--danger)" },
    success: { bg:"var(--success-dim)", color:"var(--success)", border:"var(--success)" },
    warning: { bg:"var(--warning-dim)", color:"var(--warning)", border:"var(--warning)" },
    info:    { bg:"var(--accent-dim)",  color:"var(--accent)",  border:"var(--accent)" },
  }[type] || {}
  const icons = { danger:"✕", success:"✓", warning:"⚠", info:"ℹ" }
  return (
    <div className="fade-in" style={{ padding:"9px 13px", background:c.bg, color:c.color, borderRadius:"var(--radius-sm)", border:`1px solid ${c.border}`, fontSize:12, lineHeight:1.5, display:"flex", gap:7, alignItems:"flex-start" }}>
      <span style={{marginTop:1}}>{icons[type]}</span>
      <span>{children}</span>
    </div>
  )
}

// ─── Field Editor ─────────────────────────────────────────────────────────────
const FIELD_TYPES = ["text","integer","decimal","select_one","select_multiple","date","time","note","geopoint"]
let _fieldIdCounter = 0
const newFieldId = () => `f_${++_fieldIdCounter}_${Date.now()}`

function FieldEditor({ fields, setFields }) {
  const [collapsed, setCollapsed] = useState(false)

  function addField() {
    setFields(f => [...f, { _id:newFieldId(), name:`field_${f.length+1}`, type:"text", label:"", choices:null }])
  }
  function updateField(id, key, val) {
    setFields(f => f.map(x => x._id===id ? {...x,[key]:val} : x))
  }
  function removeField(id) {
    setFields(f => f.filter(x => x._id!==id))
  }
  function updateChoices(id, val) {
    const choices = val.split(",").map(s=>s.trim()).filter(Boolean)
    updateField(id, "choices", choices.length>0 ? choices : null)
  }
  const isSelect = t => t==="select_one"||t==="select_multiple"

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:collapsed?0:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)" }}>{fields.length} field{fields.length!==1?"s":""} defined</span>
          {fields.length>0 && <Badge variant="accent">{fields.length}</Badge>}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <Btn variant="ghost" onClick={()=>setCollapsed(c=>!c)} style={{padding:"4px 10px",fontSize:11}}>{collapsed?"▼ Show":"▲ Hide"}</Btn>
          <Btn variant="secondary" onClick={addField} style={{padding:"4px 10px",fontSize:11}}><PlusIcon /> Add Field</Btn>
          {fields.length>0 && <Btn variant="danger" onClick={()=>setFields([])} style={{padding:"4px 10px",fontSize:11}}>Clear All</Btn>}
        </div>
      </div>
      {!collapsed && fields.length>0 && (
        <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 140px 1fr 32px", gap:8, padding:"0 4px" }}>
            {["Field Name","Type","Choices (comma-separated)",""].map(h=>(
              <span key={h} style={{ fontSize:10, fontWeight:700, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</span>
            ))}
          </div>
          {fields.map(f=>(
            <div key={f._id} className="fade-in" style={{ display:"grid", gridTemplateColumns:"1fr 140px 1fr 32px", gap:8, alignItems:"center", padding:"8px 10px", background:"var(--bg-subtle)", borderRadius:"var(--radius-sm)", border:"1px solid var(--border-sub)" }}>
              <input value={f.name} onChange={e=>updateField(f._id,"name",e.target.value)} placeholder="field_name" style={{ padding:"5px 8px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, color:"var(--text)", fontSize:12, fontFamily:"var(--font-mono)", outline:"none", width:"100%" }}/>
              <select value={f.type} onChange={e=>updateField(f._id,"type",e.target.value)} style={{ padding:"5px 8px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, color:"var(--text)", fontSize:12, outline:"none", width:"100%" }}>
                {FIELD_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <input value={isSelect(f.type)?(f.choices||[]).join(", "):""} onChange={e=>updateChoices(f._id,e.target.value)} placeholder={isSelect(f.type)?"yes, no, maybe":"— N/A for this type"} disabled={!isSelect(f.type)} style={{ padding:"5px 8px", background:isSelect(f.type)?"var(--surface)":"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:4, color:isSelect(f.type)?"var(--text)":"var(--text-dim)", fontSize:12, outline:"none", width:"100%", cursor:isSelect(f.type)?"text":"not-allowed" }}/>
              <button onClick={()=>removeField(f._id)} style={{ width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--danger-dim)", color:"var(--danger)", border:"none", borderRadius:4, cursor:"pointer" }}><TrashIcon/></button>
            </div>
          ))}
        </div>
      )}
      {!collapsed && fields.length===0 && (
        <div style={{ padding:"20px", textAlign:"center", border:"2px dashed var(--border)", borderRadius:"var(--radius-sm)", color:"var(--text-dim)", fontSize:12 }}>
          No fields defined. Add fields manually or load a KoboToolbox schema above.
        </div>
      )}
    </div>
  )
}

// ─── Push Progress ────────────────────────────────────────────────────────────
function PushProgress({ current, total, pushed, failed }) {
  const pct = total>0 ? Math.round((current/total)*100) : 0
  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)" }}>Pushing row {current} of {total}…</span>
        <div style={{ display:"flex", gap:8 }}>
          <Badge variant="success">✓ {pushed}</Badge>
          {failed>0 && <Badge variant="danger">✕ {failed}</Badge>}
        </div>
      </div>
      <div style={{ height:6, background:"var(--bg-subtle)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:"var(--accent)", borderRadius:99, transition:"width 0.3s ease" }}/>
      </div>
      <div style={{ fontSize:11, color:"var(--text-dim)", textAlign:"right" }}>{pct}%</div>
    </div>
  )
}

// ─── Row Editor ───────────────────────────────────────────────────────────────
function RowEditor({ row, columns, onSave, onCancel }) {
  const [values, setValues] = useState({ ...row })
  const editableCols = columns.filter(c => !c.startsWith("_"))

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:10, padding:"12px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:"var(--radius-sm)" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:10 }}>
        {editableCols.map(col => (
          <label key={col} style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <span style={{ fontSize:10, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.05em", fontFamily:"var(--font-mono)" }}>{col}</span>
            <input
              value={String(values[col] ?? "")}
              onChange={e => setValues(v => ({ ...v, [col]: e.target.value }))}
              style={{ padding:"6px 9px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"var(--text)", fontSize:12, outline:"none", width:"100%", transition:"border-color 0.15s, box-shadow 0.15s" }}
              onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow="0 0 0 3px var(--accent-glow)" }}
              onBlur={e  => { e.target.style.borderColor="var(--border)";  e.target.style.boxShadow="none" }}
            />
          </label>
        ))}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <Btn variant="success" onClick={() => onSave(values)} style={{padding:"5px 12px", fontSize:11}}>
          <SaveIcon /> Save Row
        </Btn>
        <Btn variant="ghost" onClick={onCancel} style={{padding:"5px 12px", fontSize:11}}>Cancel</Btn>
      </div>
    </div>
  )
}

// ─── Collection Table ─────────────────────────────────────────────────────────
function CollectionTable({ collection, setCollection, columns, isPushing }) {
  const [editingIndex, setEditingIndex] = useState(null)

  function saveEdit(index, updatedValues) {
    setCollection(prev => prev.map((row, i) => i === index ? { ...row, ...updatedValues } : row))
    setEditingIndex(null)
  }

  function deleteRow(index) {
    setCollection(prev => prev.filter((_, i) => i !== index))
    if (editingIndex === index) {
      setEditingIndex(null)
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }
  }

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ background:"var(--surface-2)" }}>
            <th style={{ padding:"7px 10px", fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--text-dim)", borderBottom:"1px solid var(--border)", fontFamily:"var(--font-mono)", width:36 }}>#</th>
            {columns.map(col => (
              <th key={col} style={{ padding:"7px 10px", fontSize:9, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--text-muted)", borderBottom:"1px solid var(--border)", whiteSpace:"nowrap", fontFamily:"var(--font-mono)" }}>{col}</th>
            ))}
            <th style={{ padding:"7px 10px", fontSize:9, fontWeight:700, textTransform:"uppercase", color:"var(--text-dim)", borderBottom:"1px solid var(--border)", width:80, textAlign:"center" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {collection.map((row, i) => (
            <React.Fragment key={row._rowId || i}>
              <tr className="tr" style={{ borderBottom:"1px solid var(--border-sub)", background: editingIndex===i ? "var(--accent-dim)" : i%2===0?"var(--surface)":"var(--surface-2)" }}>
                <td style={{ padding:"6px 10px", color:"var(--text-dim)", fontSize:10, fontFamily:"var(--font-mono)" }}>{i+1}</td>
                {columns.map(col => (
                  <td key={col} style={{ padding:"6px 10px", color:col.startsWith("_")?"var(--text-muted)":"var(--text)", fontFamily:col.startsWith("_")?"var(--font-mono)":"var(--font-sans)", fontSize:col.startsWith("_")?10:12, whiteSpace:"nowrap", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis" }}>
                    {String(row[col] ?? "")}
                  </td>
                ))}
                <td style={{ padding:"6px 10px", textAlign:"center" }}>
                  <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
                    <button
                      onClick={() => setEditingIndex(editingIndex===i ? null : i)}
                      disabled={isPushing}
                      title={editingIndex===i ? "Close editor" : "Edit this row"}
                      style={{
                        width:28, height:28,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background: editingIndex===i ? "var(--accent)" : "var(--accent-dim)",
                        color: editingIndex===i ? "#fff" : "var(--accent)",
                        border: editingIndex===i ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                        borderRadius:5,
                        cursor: isPushing ? "not-allowed" : "pointer",
                        opacity: isPushing ? 0.5 : 1,
                      }}
                    >
                      <EditIcon/>
                    </button>
                    <button
                      onClick={() => deleteRow(i)}
                      disabled={isPushing}
                      title="Delete this row"
                      style={{
                        width:28, height:28,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background:"var(--danger-dim)",
                        color:"var(--danger)",
                        border:"1.5px solid transparent",
                        borderRadius:5,
                        cursor: isPushing ? "not-allowed" : "pointer",
                        opacity: isPushing ? 0.5 : 1,
                      }}
                    >
                      <TrashIcon/>
                    </button>
                  </div>
                </td>
              </tr>
              {editingIndex===i && (
                <tr key={`edit-${i}`}>
                  <td colSpan={columns.length+2} style={{ padding:"0 10px 10px" }}>
                    <RowEditor
                      row={row}
                      columns={columns}
                      onSave={vals => saveEdit(i, vals)}
                      onCancel={() => setEditingIndex(null)}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function KoboFiller() {
  const { theme, toggle } = useTheme()

  const [koboToken, setKoboToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [assetId, setAssetId]     = useState("")
  const [fields, setFields]       = useState([])
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [schemaError, setSchemaError]     = useState("")

  const [provider, setProvider]       = useState("groq")
  const [config, setConfig]           = useState({ distribution:"realistic", entries:10, country:"Nigeria" })
  const [enumerators, setEnumerators] = useState(3)
  const [days, setDays]               = useState(3)
  const [startDate, setStartDate]     = useState("")
  useEffect(() => { setStartDate(new Date().toISOString().slice(0,10)) }, [])

  const [lastBatch, setLastBatch]   = useState([])
  const [loading, setLoading]       = useState(false)
  const [genError, setGenError]     = useState("")
  const [genWarning, setGenWarning] = useState("")
  const [accumulatedRecords, setAccumulatedRecords] = useState([])

  const [collection, setCollection]   = useState([])
  const [activeTab, setActiveTab]     = useState("generate")

  const [pushProgress, setPushProgress] = useState(null)
  const [pushResult, setPushResult]     = useState(null)
  const [pushError, setPushError]       = useState("")

  const hasCollection  = collection.length > 0
  const collectionFull = collection.length >= MAX_COLLECTION
  const collectionCols = hasCollection ? Object.keys(collection[0]) : []
  const isPushing      = pushProgress !== null

  async function loadSchema() {
    if (!assetId.trim())   return setSchemaError("Please enter a KoboToolbox Asset ID.")
    if (!koboToken.trim()) return setSchemaError("Please enter your KoboToolbox API token first.")
    setSchemaLoading(true); setSchemaError(""); setFields([])
    try {
      const params = new URLSearchParams({ assetId:assetId.trim(), koboToken:koboToken.trim() })
      const res  = await fetch(`/api/schema?${params}`)
      const text = await res.text()
      let data
      try { data = JSON.parse(text) }
      catch { throw new Error(text.slice(0, 200) || "Server returned an invalid response.") }
      if (!res.ok) throw new Error(data.error || "Failed to load schema")
      setFields((data.fields||[]).map(f=>({...f, _id:newFieldId()})))
    } catch(e) { setSchemaError(e.message) }
    finally { setSchemaLoading(false) }
  }

  async function generate() {
    setLoading(true); setGenError(""); setLastBatch([]); setGenWarning(""); setAccumulatedRecords([])

    const target    = Math.max(1, config.entries || 10)
    const CHUNK     = 20
    const maxChunks = Math.ceil(target / CHUNK) + 2

    let accumulated     = []
    let previousContext = undefined

    try {
      let chunks = 0
      while (accumulated.length < target && chunks < maxChunks) {
        chunks++
        const batchSize = Math.min(CHUNK, target - accumulated.length)

        const res = await fetch("/api/generate", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ config, fields, batchSize, previousContext }),
        })
        const text = await res.text()
        let data
        try { data = JSON.parse(text) }
        catch { throw new Error(text.slice(0, 200) || "Server returned an invalid response. Try again.") }
        if (!res.ok) throw new Error(data.error || "Generation failed")

        if (!data.records?.length) {
          if (accumulated.length > 0) {
            setGenWarning(`AI returned partial data. Got ${accumulated.length} of ${target} rows.`)
            break
          }
          throw new Error("AI returned empty data. Try again.")
        }

        accumulated = accumulated.concat(data.records)
        setAccumulatedRecords([...accumulated])   // maintain running state
        previousContext = data.updatedContext       // thread context into next chunk

        if (accumulated.length < target) await new Promise(r => setTimeout(r, 120))
      }

      // Post-process the FULL accumulated set (chunk-cross-cutting concerns):
      // trim to target, dedupe across chunks, then simulate enumerators/timestamps.
      const trimmed = accumulated.slice(0, target)
      const deduped = removeDuplicates(trimmed)
      const final   = simulateEnumerator(deduped, enumerators || 3, days || 3, startDate)

      setAccumulatedRecords(final)
      setLastBatch(final)
      if (final.length < target) setGenWarning(`Generated ${final.length} of ${target} rows.`)
    } catch(e) { setGenError(e.message) }
    finally { setLoading(false) }
  }

  function addToCollection() {
    if (!lastBatch.length) return
    const canAdd = MAX_COLLECTION - collection.length
    if (canAdd <= 0) return
    const toAdd = lastBatch.slice(0, canAdd).map((row, i) => ({
      ...row,
      _rowId: `row_${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}`,
    }))
    setCollection(prev => [...prev, ...toAdd])
    setLastBatch([])
    setGenWarning("")
    setActiveTab("collection")
  }

  async function pushToKobo() {
    if (!assetId.trim())    return setPushError("Enter an Asset ID to push data.")
    if (!koboToken.trim())  return setPushError("Enter your API token to push data.")
    if (!collection.length) return setPushError("Your collection is empty.")
    setPushError(""); setPushResult(null)
    setPushProgress({ current:0, total:collection.length, pushed:0, failed:0 })
    try {
      const res = await fetch("/api/kobo", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ assetId:assetId.trim(), koboToken:koboToken.trim(), rows:collection }),
      })
      if (!res.ok || !res.body) {
        const text = await res.text()
        let errMsg = "Push failed"
        try { errMsg = JSON.parse(text)?.error || errMsg } catch {}
        throw new Error(errMsg)
      }
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      const processBuffer = () => {
        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith("data:")) continue
          try {
            const msg = JSON.parse(line.slice(5).trim())
            if (msg.type==="progress") {
              setPushProgress({ current:msg.current, total:msg.total, pushed:msg.pushed, failed:msg.failed })
            } else if (msg.type==="done") {
              setPushProgress(null)
              setPushResult({ pushed:msg.pushed, failed:msg.failed, errors:msg.errors })
            }
          } catch {}
        }
      }
      while (true) {
        const { done, value } = await reader.read()
        if (value) buffer += decoder.decode(value, { stream:true })
        processBuffer()
        if (done) { buffer += decoder.decode(); processBuffer(); break }
      }
    } catch(e) { setPushProgress(null); setPushError(e.message) }
  }

  return (
    <>
      <style>{`
        @media (max-width:700px)  { .g3 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width:700px)  { .g4 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width:480px)  { .g3, .g4 { grid-template-columns: 1fr !important; } }
        .tr:hover td { background: var(--accent-dim) !important; transition: background 0.1s; }
        .icon-btn:hover { border-color: var(--accent) !important; color: var(--accent) !important; }
        .tab-btn { padding: 8px 18px; border: none; border-bottom: 2px solid transparent; background: transparent; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-muted); font-family: var(--font-sans); transition: all 0.15s; }
        .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
        .tab-btn:hover:not(.active) { color: var(--text); }
      `}</style>

      <header style={{ position:"sticky", top:0, zIndex:100, background:"var(--surface)", borderBottom:"1px solid var(--border)", boxShadow:"var(--shadow-sm)" }}>
        <div style={{ maxWidth:980, margin:"0 auto", padding:"0 20px", height:54, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:7, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px var(--accent-glow)" }}>
              <span style={{ fontSize:15 }}>🗂</span>
            </div>
            <div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:14, color:"var(--text)", lineHeight:1 }}>KoboFiller</div>
              <div style={{ fontSize:9, color:"var(--text-dim)", letterSpacing:"0.07em", textTransform:"uppercase", lineHeight:1, marginTop:2 }}>AI Data Generator</div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center" }}>
            <button className={`tab-btn ${activeTab==="generate"?"active":""}`} onClick={()=>setActiveTab("generate")}>
              ✨ Generate
            </button>
            <button className={`tab-btn ${activeTab==="collection"?"active":""}`} onClick={()=>setActiveTab("collection")}>
              📋 Collection
              {hasCollection && (
                <span style={{ marginLeft:6, padding:"1px 6px", borderRadius:99, fontSize:10, fontWeight:700, background:"var(--accent)", color:"#fff", fontFamily:"var(--font-mono)" }}>
                  {collection.length}
                </span>
              )}
            </button>
          </div>

          <button onClick={toggle} className="icon-btn" title={`Switch to ${theme==="light"?"dark":"light"} mode`} style={{ width:34, height:34, borderRadius:"var(--radius-sm)", background:"var(--surface-2)", border:"1px solid var(--border)", color:"var(--text-muted)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all var(--transition)" }}>
            {theme==="light" ? <MoonIcon/> : <SunIcon/>}
          </button>
        </div>
      </header>

      <main style={{ maxWidth:980, margin:"0 auto", padding:"24px 20px 60px", display:"flex", flexDirection:"column", gap:14 }}>

        {activeTab==="generate" && (
          <>
            <Card>
              <CardHeader title="KoboToolbox Credentials" subtitle="Your token is sent directly to KoboToolbox and never stored on our servers" badge={koboToken ? <Badge variant="success"><CheckIcon/> Connected</Badge> : <Badge variant="warning">Required</Badge>}/>
              <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ flex:1 }}>
                  <Label>API Token</Label>
                  <div style={{ position:"relative" }}>
                    <input type={showToken?"text":"password"} value={koboToken} onChange={e=>setKoboToken(e.target.value)} placeholder="Paste your KoboToolbox API token here"
                      style={{ padding:"8px 38px 8px 11px", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"var(--text)", fontSize:13, fontFamily:"var(--font-mono)", width:"100%", outline:"none", transition:"border-color var(--transition), box-shadow var(--transition)" }}
                      onFocus={e=>{e.target.style.borderColor="var(--accent)";e.target.style.boxShadow="0 0 0 3px var(--accent-glow)"}}
                      onBlur={e=>{e.target.style.borderColor="var(--border)";e.target.style.boxShadow="none"}}
                    />
                    <button onClick={()=>setShowToken(s=>!s)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", padding:2, display:"flex" }}>
                      {showToken ? <EyeOffIcon/> : <EyeIcon/>}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize:11, color:"var(--text-dim)", margin:0 }}>Get your token: KoboToolbox → <strong>Account Settings</strong> → <strong>API Key</strong>.</p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Form Schema" subtitle="Load fields from a KoboToolbox form, or define them manually below" badge={fields.length>0 ? <Badge variant="success"><CheckIcon/> {fields.length} fields</Badge> : <Badge variant="default">Optional</Badge>}/>
              <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <Input label="Asset ID" value={assetId} onChange={e=>setAssetId(e.target.value)} placeholder="e.g. aXmK9dJqR3bLpQ" onKeyDown={e=>e.key==="Enter"&&loadSchema()}/>
                  </div>
                  <Btn variant="secondary" loading={schemaLoading} onClick={loadSchema}>{schemaLoading?"Loading...":"Load Schema"}</Btn>
                </div>
                {schemaError && <Alert type="danger">{schemaError}</Alert>}
                {fields.length>0 && (
                  <div className="fade-in" style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:"var(--radius-sm)", padding:"8px 12px", display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"var(--accent)", fontWeight:700, marginRight:4 }}>Loaded:</span>
                    {fields.slice(0,8).map(f=>(
                      <span key={f._id||f.name} style={{ fontSize:10, padding:"2px 7px", borderRadius:99, background:"var(--surface)", color:"var(--text-muted)", border:"1px solid var(--border)", fontFamily:"var(--font-mono)" }}>{f.name}</span>
                    ))}
                    {fields.length>8 && <span style={{ fontSize:11, color:"var(--text-muted)" }}>+{fields.length-8} more</span>}
                  </div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1, height:1, background:"var(--border-sub)" }}/>
                  <span style={{ fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>or edit manually</span>
                  <div style={{ flex:1, height:1, background:"var(--border-sub)" }}/>
                </div>
                <FieldEditor fields={fields} setFields={setFields}/>
              </div>
            </Card>

            <Card>
              <CardHeader title="Generation Settings" subtitle="Configure AI provider, distribution, and collection parameters"/>
              <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
                <div className="g3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                  <Select label="AI Provider" value={provider} onChange={e=>setProvider(e.target.value)}>
                    <option value="groq">Groq — Llama 3.3 (Fast)</option>
                    <option value="anthropic">Anthropic — Claude Haiku</option>
                  </Select>
                  <Select label="Distribution" value={config.distribution} onChange={e=>setConfig(c=>({...c,distribution:e.target.value}))}>
                    <option value="realistic">Realistic</option>
                    <option value="uniform">Uniform</option>
                    <option value="normal">Normal</option>
                  </Select>
                  <Input label="Country / Region" type="text" value={config.country} onChange={e=>setConfig(c=>({...c,country:e.target.value}))} placeholder="Nigeria"/>
                </div>
                <div className="g4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
                  <Input label="Entries" type="number" min={1} max={100} value={config.entries} onChange={e=>setConfig(c=>({...c,entries:Math.max(1,parseInt(e.target.value)||10)}))}/>
                  <Input label="Enumerators" type="number" min={1} max={10} value={enumerators} onChange={e=>setEnumerators(Math.max(1,parseInt(e.target.value)||1))}/>
                  <Input label="Days" type="number" min={1} max={7} value={days} onChange={e=>setDays(Math.max(1,parseInt(e.target.value)||1))}/>
                  <Input label="Start Date" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Generate" subtitle={collectionFull ? `Collection is full (${MAX_COLLECTION}/${MAX_COLLECTION})` : `Collection: ${collection.length}/${MAX_COLLECTION} rows`} badge={lastBatch.length>0 ? <Badge variant="accent">{lastBatch.length} ready to add</Badge> : null}/>
              <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  <Btn loading={loading} disabled={isPushing||collectionFull} onClick={generate} style={{ minWidth:140 }}>
                    {loading ? "Generating…" : "✨ Generate Batch"}
                  </Btn>
                  {lastBatch.length>0 && (
                    <Btn variant="success" disabled={loading||isPushing||collectionFull} onClick={addToCollection} style={{ minWidth:160 }}>
                      ➕ Add {Math.min(lastBatch.length, MAX_COLLECTION-collection.length)} to Collection
                    </Btn>
                  )}
                  {lastBatch.length>0 && (
                    <Btn variant="ghost" disabled={loading||isPushing} onClick={()=>{ setLastBatch([]); setGenWarning("") }}>
                      Discard
                    </Btn>
                  )}
                </div>
                {collectionFull && <Alert type="info">Collection is full at {MAX_COLLECTION} rows. Go to the Collection tab to edit, export, or clear it.</Alert>}
                {genWarning && <Alert type="warning">{genWarning}</Alert>}
                {genError && <Alert type="danger">{genError}</Alert>}
              </div>
            </Card>

            {lastBatch.length>0 && (
              <Card>
                <CardHeader title="Batch Preview" subtitle={`${lastBatch.length} rows just generated — review before adding to collection`} badge={<Badge variant="accent">{lastBatch.length} rows</Badge>}/>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ background:"var(--surface-2)" }}>
                        <th style={{ padding:"7px 10px", fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--text-dim)", borderBottom:"1px solid var(--border)", fontFamily:"var(--font-mono)", width:36 }}>#</th>
                        {Object.keys(lastBatch[0]).map(col=>(
                          <th key={col} style={{ padding:"7px 10px", fontSize:9, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--text-muted)", borderBottom:"1px solid var(--border)", whiteSpace:"nowrap", fontFamily:"var(--font-mono)" }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lastBatch.map((row,i)=>(
                        <tr key={i} className="tr" style={{ borderBottom:"1px solid var(--border-sub)" }}>
                          <td style={{ padding:"6px 10px", color:"var(--text-dim)", fontSize:10, fontFamily:"var(--font-mono)", background:i%2===0?"var(--surface)":"var(--surface-2)" }}>{i+1}</td>
                          {Object.keys(lastBatch[0]).map(col=>(
                            <td key={col} style={{ padding:"6px 10px", color:col.startsWith("_")?"var(--text-muted)":"var(--text)", fontFamily:col.startsWith("_")?"var(--font-mono)":"var(--font-sans)", fontSize:col.startsWith("_")?10:12, background:i%2===0?"var(--surface)":"var(--surface-2)", whiteSpace:"nowrap", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis" }}>
                              {String(row[col]??"")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding:"10px 16px", borderTop:"1px solid var(--border-sub)", background:"var(--surface-2)", display:"flex", gap:8, flexWrap:"wrap" }}>
                  <Btn variant="success" disabled={collectionFull} onClick={addToCollection}>
                    ➕ Add to Collection ({collection.length}/{MAX_COLLECTION})
                  </Btn>
                  <Btn variant="ghost" onClick={()=>{ setLastBatch([]); setGenWarning("") }}>Discard</Btn>
                </div>
              </Card>
            )}
          </>
        )}

        {activeTab==="collection" && (
          <>
            <Card>
              <CardHeader
                title="Collection"
                subtitle="Accumulated rows ready to edit, export, or push to KoboToolbox"
                badge={<Badge variant={collection.length>=MAX_COLLECTION?"danger":"accent"}>{collection.length}/{MAX_COLLECTION}</Badge>}
              />
              <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
                {hasCollection ? (
                  <>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      <Btn variant="secondary" disabled={isPushing||loading} onClick={()=>exportExcel(collection)}>📥 Excel</Btn>
                      <Btn variant="secondary" disabled={isPushing||loading} onClick={()=>exportCSV(collection)}>📄 CSV</Btn>
                      {assetId && (
                        <Btn variant="success" loading={isPushing} disabled={loading} onClick={pushToKobo} style={{ minWidth:170 }}>
                          {isPushing ? "Pushing…" : "🚀 Push to KoboToolbox"}
                        </Btn>
                      )}
                      <Btn variant="danger" disabled={isPushing||loading} onClick={()=>{ setCollection([]); setPushResult(null); setPushError("") }}>
                        🗑 Clear All
                      </Btn>
                    </div>
                    {pushProgress && <PushProgress current={pushProgress.current} total={pushProgress.total} pushed={pushProgress.pushed} failed={pushProgress.failed}/>}
                    {pushError && <Alert type="danger">{pushError}</Alert>}
                    {pushResult && (
                      <Alert type={pushResult.failed>0?"warning":"success"}>
                        {pushResult.pushed} row{pushResult.pushed!==1?"s":""} pushed successfully{pushResult.failed>0?`, ${pushResult.failed} failed`:" — all done!"}.
                        {pushResult.errors?.length>0 && (
                          <div style={{ marginTop:4, fontSize:11, opacity:0.85 }}>
                            {pushResult.errors.map((e,i)=><div key={i}>{e}</div>)}
                          </div>
                        )}
                      </Alert>
                    )}
                    {!assetId && (
                      <Alert type="info">Enter your Asset ID on the Generate tab to enable pushing to KoboToolbox.</Alert>
                    )}
                  </>
                ) : (
                  <div style={{ padding:"32px 20px", textAlign:"center", color:"var(--text-dim)", fontSize:13 }}>
                    <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
                    <div style={{ fontWeight:600, marginBottom:6 }}>Your collection is empty</div>
                    <div style={{ fontSize:12, marginBottom:16 }}>Go to the Generate tab, generate a batch, then click <strong>Add to Collection</strong>.</div>
                    <Btn variant="secondary" onClick={()=>setActiveTab("generate")}>← Go to Generate</Btn>
                  </div>
                )}
              </div>
            </Card>

            {hasCollection && (
              <Card>
                <CardHeader
                  title="Edit Collection"
                  subtitle="Click ✏️ on any row to edit its values. Click 🗑 to delete a row."
                  badge={<Badge variant="accent">{collectionCols.length} cols</Badge>}
                />
                <CollectionTable
                  collection={collection}
                  setCollection={setCollection}
                  columns={collectionCols}
                  isPushing={isPushing}
                />
                <div style={{ padding:"8px 14px", borderTop:"1px solid var(--border-sub)", background:"var(--surface-2)", fontSize:10, color:"var(--text-dim)", display:"flex", gap:12, flexWrap:"wrap" }}>
                  <span>Columns prefixed <code style={{ fontFamily:"var(--font-mono)", background:"var(--bg)", padding:"1px 4px", borderRadius:3 }}>_</code> are KoboFiller metadata — not editable.</span>
                  <span style={{ marginLeft:"auto" }}>{collection.length} rows · {collectionCols.length} columns</span>
                </div>
              </Card>
            )}
          </>
        )}
      </main>

      <footer style={{ borderTop:"1px solid var(--border)", background:"var(--surface)", padding:"12px 20px", textAlign:"center", fontSize:10, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>
        KoboFiller · AI-powered synthetic survey data · Built with Next.js
      </footer>
    </>
  )
}
