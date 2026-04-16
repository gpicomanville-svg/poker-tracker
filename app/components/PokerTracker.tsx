'use client'

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

const STORAGE_KEY = "poker-sessions-v3";
const fmt = (n: number) => Math.abs(n).toFixed(2) + "€";
const today = () => new Date().toISOString().slice(0, 10);
const STAKES = ["0.10/0.20","0.25/0.50","0.50/1","1/2","1/3","2/5","5/10","10/20","Otro"];

interface Session {
  id: number;
  date: string;
  venue: string;
  players: string;
  stakes: string;
  customStakes: string;
  buyin: string;
  rebuys: number[];
  cashout: string;
  notes: string;
  open: boolean;
}

const emptySession = (): Session => ({
  id: Date.now(), date: today(), venue: "", players: "",
  stakes: "", customStakes: "", buyin: "", rebuys: [], cashout: "", notes: "", open: true,
});

const calcProfit = (s: Session) => (parseFloat(s.cashout)||0) - (parseFloat(s.buyin)||0) - s.rebuys.reduce((a,b)=>a+b,0);
const calcInvested = (s: Session) => (parseFloat(s.buyin)||0) + s.rebuys.reduce((a,b)=>a+b,0);
const stakesLabel = (s: Session) => s.stakes === "Otro" ? (s.customStakes||"Otro") : s.stakes;

const CSS_ANIMATIONS = `
@keyframes fadeInUp {
  from { opacity:0; transform:translateY(16px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes fadeInScale {
  from { opacity:0; transform:scale(0.85); }
  to   { opacity:1; transform:scale(1); }
}
@keyframes pulse {
  0%,100% { opacity:1; }
  50%      { opacity:0.4; }
}
@keyframes slideIn {
  from { opacity:0; transform:translateX(-12px); }
  to   { opacity:1; transform:translateX(0); }
}
@keyframes glow {
  0%,100% { box-shadow: 0 0 8px rgba(201,168,76,0.3); }
  50%      { box-shadow: 0 0 20px rgba(201,168,76,0.7); }
}
@keyframes numberPop {
  0%   { transform:scale(1); }
  50%  { transform:scale(1.06); }
  100% { transform:scale(1); }
}
.ani-fadeup   { animation: fadeInUp 0.35s ease both; }
.ani-scale    { animation: fadeInScale 0.3s ease both; }
.ani-slidein  { animation: slideIn 0.25s ease both; }
.ani-pulse    { animation: pulse 1.8s ease-in-out infinite; }
.ani-glow     { animation: glow 2s ease-in-out infinite; }
.ani-pop      { animation: numberPop 0.25s ease; }
`;

export default function PokerTracker() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [view, setView] = useState("home");
  const [cur, setCur] = useState<Session | null>(null);
  const [editing, setEditing] = useState<Session | null>(null);
  const [rebuyAmt, setRebuyAmt] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [, setRebuyFlash] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS_ANIMATIONS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSessions(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  const sync = (data: Session[]) => {
    setSessions(data);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  };

  const closed = sessions.filter(s=>!s.open);
  const totalP = closed.reduce((a,s)=>a+calcProfit(s),0);
  const wins = closed.filter(s=>calcProfit(s)>0).length;
  const openS = sessions.find(s=>s.open);

  const chartData = [...closed].reverse().reduce((acc: {x:string,v:number}[],s,i)=>{
    const prev = i===0?0:acc[i-1].v;
    acc.push({ x:s.date.slice(5), v:parseFloat((prev+calcProfit(s)).toFixed(2)) });
    return acc;
  },[]);

  const C = {
    bg:"#07100a", card:"#0b1a0f", felt:"#0e2015",
    border:"#1a3322", gold:"#c9a84c", goldDim:"rgba(201,168,76,0.15)",
    green:"#22c55e", greenDim:"rgba(34,197,94,0.12)",
    red:"#ef4444", redDim:"rgba(239,68,68,0.12)",
    muted:"#3a5444", text:"#cde8d4", dim:"#5a7a65",
  };

  if (!loaded) return null;

  const NavBar = ({active}: {active: string}) => (
    <div style={{ display:"flex", borderTop:`1px solid ${C.border}`, background:C.card }}>
      {[["home","♠","Inicio"],["history","♦","Historial"],["chart","♣","Gráfica"]].map(([v,icon,label])=>(
        <button key={v} onClick={()=>setView(v)}
          style={{ flex:1, padding:"13px 0 10px", background:"none", border:"none",
            borderTop:`2px solid ${active===v?C.gold:"transparent"}`,
            fontFamily:"'Courier New',monospace", fontSize:9, letterSpacing:2,
            color:active===v?C.gold:C.muted, cursor:"pointer", textTransform:"uppercase" }}>
          <div style={{fontSize:16, marginBottom:3}}>{icon}</div>{label}
        </button>
      ))}
    </div>
  );

  const StatBar = ({items}: {items: [string, string, string?][]}) => (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${items.length},1fr)`, borderBottom:`1px solid ${C.border}` }}>
      {items.map(([val,label,color],i)=>(
        <div key={i} style={{ padding:"14px 10px", textAlign:"center", borderRight:i<items.length-1?`1px solid ${C.border}`:"none" }}>
          <div style={{ fontSize:20, fontWeight:700, letterSpacing:-0.5, color:color||C.gold, fontFamily:"'Courier New',monospace" }}>{val}</div>
          <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:2, marginTop:5, fontFamily:"'Courier New',monospace" }}>{label}</div>
        </div>
      ))}
    </div>
  );

  const MoneyCard = ({label, sublabel, value, onChange, readOnly, color, animDelay="0s", glowActive}: {
    label: string; sublabel?: string; value: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    readOnly: boolean; color?: string; animDelay?: string; glowActive?: boolean;
  }) => (
    <div className={glowActive?"ani-glow":""} style={{ background:C.card, border:`1px solid ${color||C.border}`,
      borderRadius:2, padding:"18px 20px", position:"relative", transition:"border-color 0.3s",
      animationDelay:animDelay }}>
      <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", fontFamily:"'Courier New',monospace", marginBottom:8 }}>
        {label}
      </div>
      {sublabel && <div style={{ fontSize:10, color:C.dim, marginBottom:10, fontFamily:"'Courier New',monospace" }}>{sublabel}</div>}
      {readOnly ? (
        <div style={{ fontSize:32, fontWeight:700, color:color||C.text, letterSpacing:-1, fontFamily:"'Courier New',monospace" }}>
          {value}
        </div>
      ) : (
        <div style={{ position:"relative" }}>
          <input
            type="number" placeholder="0.00" value={value} onChange={onChange}
            style={{ width:"100%", boxSizing:"border-box", background:"transparent", border:"none",
              borderBottom:`2px solid ${color||C.border}`, outline:"none", fontSize:32, fontWeight:700,
              color:color||C.text, fontFamily:"'Courier New',monospace", padding:"4px 0 8px",
              letterSpacing:-1 }} />
          <div style={{ position:"absolute", right:0, bottom:10, fontSize:20, color:C.muted, fontFamily:"'Courier New',monospace" }}>€</div>
        </div>
      )}
    </div>
  );

  const RebuySection = ({rebuys, onAdd, onRemove, readOnly, amt, setAmt}: {
    rebuys: number[]; onAdd: () => void; onRemove: (i: number) => void;
    readOnly: boolean; amt: string; setAmt: (v: string) => void;
  }) => (
    <div style={{ background:C.felt, border:`1px solid ${C.border}`, borderRadius:2, padding:"16px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", fontFamily:"'Courier New',monospace" }}>Re buy-in</div>
          <div style={{ fontSize:10, color:C.dim, marginTop:3, fontFamily:"'Courier New',monospace" }}>
            {rebuys.length===0 ? "Sin recompras" : `${rebuys.length} recompra${rebuys.length>1?"s":""} · ${fmt(rebuys.reduce((a,b)=>a+b,0))}`}
          </div>
        </div>
        {rebuys.length>0 && (
          <div style={{ fontSize:18, fontWeight:700, color:C.gold, fontFamily:"'Courier New',monospace" }}>
            +{fmt(rebuys.reduce((a,b)=>a+b,0))}
          </div>
        )}
      </div>
      {rebuys.length>0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:readOnly?0:14 }}>
          {rebuys.map((r,i)=>(
            <div key={i} className="ani-slidein"
              style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.card,
                border:`1px solid ${C.gold}44`, borderRadius:2, padding:"5px 12px",
                fontFamily:"'Courier New',monospace", fontSize:13, color:C.gold,
                animationDelay:`${i*0.05}s` }}>
              {r.toFixed(2)}€
              {!readOnly && (
                <button onClick={()=>onRemove(i)}
                  style={{ background:"none", border:"none", color:C.red, cursor:"pointer", padding:0, fontSize:15, lineHeight:1 }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <div style={{ display:"flex", gap:8 }}>
          <input type="number" placeholder="Importe recompra" value={amt}
            onChange={e=>setAmt(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&onAdd()}
            style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, outline:"none",
              color:C.text, fontFamily:"'Courier New',monospace", fontSize:14, padding:"10px 12px" }} />
          <button onClick={onAdd}
            style={{ padding:"10px 18px", background:C.gold, border:"none", color:"#000",
              fontFamily:"'Courier New',monospace", fontSize:16, fontWeight:700, cursor:"pointer" }}>+</button>
        </div>
      )}
    </div>
  );

  // ─── HOME ───
  if (view==="home") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Courier New',monospace", color:C.text, maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column" }}>
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"18px 20px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:20, fontWeight:700, letterSpacing:5, color:C.gold }}>♠ STACKS</span>
        <span style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase" }}>CASH GAME TRACKER</span>
      </div>
      <StatBar items={[
        [(totalP>=0?"+":"")+Math.abs(totalP).toFixed(2)+"€", "P&L Total", totalP>0?C.green:totalP<0?C.red:C.gold],
        [String(closed.length||"—"), "Sesiones", C.gold],
        [closed.length?Math.round(wins/closed.length*100)+"%":"—", "Win rate", C.gold],
      ]} />
      <div style={{ padding:20, flex:1 }}>
        {openS ? (
          <div className="ani-glow ani-fadeup" style={{ background:C.card, border:`1px solid ${C.gold}44`, borderRadius:2, padding:"18px 20px", marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div className="ani-pulse" style={{ fontSize:9, color:C.gold, letterSpacing:3, marginBottom:8 }}>● SESIÓN EN CURSO</div>
                <div style={{ fontSize:15, fontWeight:700 }}>{openS.venue||"Sin nombre"}</div>
                {stakesLabel(openS) && <div style={{ fontSize:12, color:C.gold, marginTop:4 }}>{stakesLabel(openS)}</div>}
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Invertido: {fmt(calcInvested(openS))}</div>
              </div>
              <button onClick={()=>{ setEditing(openS); setView("session"); }}
                style={{ padding:"12px 18px", background:C.gold, border:"none", color:"#000",
                  fontFamily:"'Courier New',monospace", fontSize:11, fontWeight:700,
                  letterSpacing:2, cursor:"pointer", textTransform:"uppercase" }}>Abrir →</button>
            </div>
          </div>
        ) : (
          <button className="ani-fadeup" onClick={()=>{ setCur(emptySession()); setView("new"); }}
            style={{ display:"block", width:"100%", padding:"16px", background:C.gold, border:"none",
              color:"#000", fontFamily:"'Courier New',monospace", fontSize:13, fontWeight:700,
              letterSpacing:3, cursor:"pointer", textTransform:"uppercase", marginBottom:10 }}>
            ♦ Nueva sesión
          </button>
        )}
      </div>
      <NavBar active="home" />
    </div>
  );

  // ─── NEW SESSION ───
  if (view==="new" && cur) {
    const inp2: React.CSSProperties = { display:"block", width:"100%", boxSizing:"border-box", background:C.felt,
      border:`1px solid ${C.border}`, color:C.text, fontFamily:"'Courier New',monospace",
      fontSize:14, padding:"12px", marginBottom:12, outline:"none" };
    const lbl2: React.CSSProperties = { fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", display:"block", marginBottom:6 };

    return (
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Courier New',monospace", color:C.text, maxWidth:480, margin:"0 auto" }}>
        <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"16px 20px", display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={()=>{ setView("home"); setCur(null); }} style={{ background:"none", border:"none", color:C.gold, fontSize:22, cursor:"pointer" }}>←</button>
          <span style={{ fontSize:14, fontWeight:700, letterSpacing:3, color:C.gold, textTransform:"uppercase" }}>Nueva sesión</span>
        </div>
        <div style={{ padding:20 }}>
          <label style={lbl2}>Fecha</label>
          <input style={inp2} type="date" value={cur.date} onChange={e=>setCur(p=>p?({...p,date:e.target.value}):p)} />

          <label style={lbl2}>Local / Casino</label>
          <input style={inp2} placeholder="Casino Gran Madrid" value={cur.venue} onChange={e=>setCur(p=>p?({...p,venue:e.target.value}):p)} />

          <label style={lbl2}>Nº de jugadores</label>
          <input style={inp2} type="number" placeholder="9" value={cur.players} onChange={e=>setCur(p=>p?({...p,players:e.target.value}):p)} />

          <label style={lbl2}>Stakes</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:12 }}>
            {STAKES.map(s=>(
              <button key={s} onClick={()=>setCur(p=>p?({...p,stakes:s}):p)}
                style={{ padding:"10px 4px", background:cur.stakes===s?C.gold:C.felt,
                  color:cur.stakes===s?"#000":C.text, border:`1px solid ${cur.stakes===s?C.gold:C.border}`,
                  fontFamily:"'Courier New',monospace", fontSize:12, fontWeight:cur.stakes===s?700:400,
                  cursor:"pointer", transition:"all 0.15s" }}>{s}</button>
            ))}
          </div>
          {cur.stakes==="Otro" && (
            <input style={inp2} placeholder="Ej: 3/6" value={cur.customStakes} onChange={e=>setCur(p=>p?({...p,customStakes:e.target.value}):p)} />
          )}

          <label style={lbl2}>Buy-in (€)</label>
          <input style={{...inp2,fontSize:24,fontWeight:700,letterSpacing:-1}} type="number" placeholder="0.00"
            value={cur.buyin} onChange={e=>setCur(p=>p?({...p,buyin:e.target.value}):p)} />

          <label style={lbl2}>Notas</label>
          <input style={inp2} placeholder="Dinámica, formato..." value={cur.notes} onChange={e=>setCur(p=>p?({...p,notes:e.target.value}):p)} />

          <button onClick={()=>{ if(!cur.buyin)return; sync([cur,...sessions]); setView("home"); setCur(null); }}
            disabled={!cur.buyin}
            style={{ display:"block", width:"100%", padding:"15px", background:cur.buyin?C.gold:"#1a3322",
              border:"none", color:cur.buyin?"#000":C.muted, fontFamily:"'Courier New',monospace",
              fontSize:13, fontWeight:700, letterSpacing:3, cursor:cur.buyin?"pointer":"default",
              textTransform:"uppercase", transition:"all 0.2s" }}>
            ♠ Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  // ─── SESSION DETAIL ───
  if (view==="session" && editing) {
    const s = editing;
    const p = calcProfit(s);
    const inv = calcInvested(s);
    const hasProfit = s.cashout !== "" || !s.open;

    const updateField = (field: keyof Session, val: string) => {
      const upd = sessions.map(ss=>ss.id===s.id?{...ss,[field]:val}:ss);
      sync(upd); setEditing({...s,[field]:val});
    };
    const addRebuy = () => {
      const amt = parseFloat(rebuyAmt);
      if(isNaN(amt)||!rebuyAmt) return;
      const upd = sessions.map(ss=>ss.id===s.id?{...ss,rebuys:[...ss.rebuys,amt]}:ss);
      sync(upd); setEditing({...s,rebuys:[...s.rebuys,amt]});
      setRebuyAmt(""); setRebuyFlash(true); setTimeout(()=>setRebuyFlash(false),600);
    };
    const removeRebuy = (idx: number) => {
      const upd = sessions.map(ss=>ss.id===s.id?{...ss,rebuys:ss.rebuys.filter((_,i)=>i!==idx)}:ss);
      sync(upd); setEditing({...s,rebuys:s.rebuys.filter((_,i)=>i!==idx)});
    };

    return (
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Courier New',monospace", color:C.text, maxWidth:480, margin:"0 auto" }}>
        <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={()=>setView(s.open?"home":"history")} style={{ background:"none", border:"none", color:C.gold, fontSize:22, cursor:"pointer" }}>←</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:14, fontWeight:700, letterSpacing:2, color:C.gold, textTransform:"uppercase" }}>{s.venue||"Sesión"}</div>
            {stakesLabel(s) && <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{stakesLabel(s)} · {s.players||"?"} jug.</div>}
          </div>
          {s.open
            ? <div className="ani-pulse" style={{ fontSize:9, color:C.gold, letterSpacing:2 }}>● LIVE</div>
            : <div style={{ fontSize:9, color:C.muted, letterSpacing:1 }}>{s.date}</div>}
        </div>

        {hasProfit && (
          <div className="ani-fadeup" style={{ background:p>0?C.greenDim:p<0?C.redDim:C.goldDim,
            borderBottom:`1px solid ${p>0?C.green+"33":p<0?C.red+"33":C.gold+"33"}`,
            padding:"20px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:6 }}>Resultado</div>
            <div className="ani-pop" style={{ fontSize:52, fontWeight:700, letterSpacing:-2,
              color:p>0?C.green:p<0?C.red:C.gold, lineHeight:1 }}>
              {p>=0?"+":""}{p.toFixed(2)}€
            </div>
          </div>
        )}

        <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
          <div className="ani-fadeup" style={{ animationDelay:"0s" }}>
            <MoneyCard label="Entrada" sublabel="Dinero con el que entras"
              value={fmt(parseFloat(s.buyin)||0)} readOnly={true} color={C.green} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:0, padding:"0 20px" }}>
            <div style={{ flex:1, height:1, background:`linear-gradient(to right, ${C.green}44, transparent)` }} />
            <div style={{ width:8, height:8, borderRadius:"50%", background:C.muted, margin:"0 8px" }} />
            <div style={{ flex:1, height:1, background:C.border }} />
          </div>
          <div className="ani-fadeup" style={{ animationDelay:"0.08s" }}>
            <RebuySection rebuys={s.rebuys} onAdd={addRebuy} onRemove={removeRebuy}
              readOnly={!s.open} amt={rebuyAmt} setAmt={setRebuyAmt} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:0, padding:"0 20px" }}>
            <div style={{ flex:1, height:1, background:C.border }} />
            <div style={{ width:8, height:8, borderRadius:"50%", background:C.muted, margin:"0 8px" }} />
            <div style={{ flex:1, height:1, background:`linear-gradient(to left, ${s.cashout?C.green+"44":C.border}, transparent)` }} />
          </div>
          <div className="ani-fadeup" style={{ animationDelay:"0.16s" }}>
            {s.open ? (
              <MoneyCard label="Salida" sublabel="Dinero con el que sales"
                value={s.cashout} onChange={e=>updateField("cashout",e.target.value)}
                color={s.cashout ? C.green : C.border} readOnly={false} glowActive={!!s.cashout} />
            ) : (
              <MoneyCard label="Salida" sublabel="Dinero con el que saliste"
                value={fmt(parseFloat(s.cashout)||0)} readOnly={true} color={p>=0?C.green:C.red} />
            )}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 16px",
            background:C.felt, border:`1px solid ${C.border}`, borderRadius:2 }}>
            <span style={{ fontSize:11, color:C.muted, letterSpacing:2, textTransform:"uppercase" }}>Total invertido</span>
            <span style={{ fontSize:15, fontWeight:700, color:C.gold }}>{fmt(inv)}</span>
          </div>
          {s.open && (
            <button onClick={()=>{
                const finalCashout = s.cashout || "0";
                sync(sessions.map(ss=>ss.id===s.id?{...ss,open:false,cashout:finalCashout}:ss));
                setEditing(null); setView("history");
              }}
              style={{ display:"block", width:"100%", padding:"15px", marginTop:4,
                background:C.gold, border:"none", color:"#000",
                fontFamily:"'Courier New',monospace", fontSize:13, fontWeight:700, letterSpacing:3,
                cursor:"pointer", textTransform:"uppercase", transition:"all 0.2s" }}>
              ✓ Cerrar sesión
            </button>
          )}
          {!s.open && s.notes && (
            <div style={{ color:C.muted, fontSize:12, padding:"10px 0" }}>📝 {s.notes}</div>
          )}
          {!s.open && (
            <button onClick={()=>{ if(confirm("¿Borrar esta sesión?")){ sync(sessions.filter(ss=>ss.id!==s.id)); setEditing(null); setView("history"); }}}
              style={{ display:"block", width:"100%", padding:"14px", background:"transparent",
                border:`1px solid ${C.red}44`, color:C.red, fontFamily:"'Courier New',monospace",
                fontSize:12, fontWeight:700, letterSpacing:2, cursor:"pointer", textTransform:"uppercase" }}>
              Borrar sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── HISTORY ───
  if (view==="history") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Courier New',monospace", color:C.text, maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column" }}>
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:16, fontWeight:700, letterSpacing:4, color:C.gold }}>♦ HISTORIAL</span>
        <span style={{ fontSize:9, color:C.muted, letterSpacing:2 }}>{closed.length} SESIONES</span>
      </div>
      <StatBar items={[
        [(totalP>=0?"+":"")+totalP.toFixed(2)+"€","Total",totalP>0?C.green:totalP<0?C.red:C.gold],
        [wins+"/"+closed.length,"Ganadas",C.gold],
        [closed.length?(totalP/closed.length).toFixed(0)+"€":"—","Media/ses.",C.gold],
      ]} />
      <div style={{ padding:20, flex:1 }}>
        {closed.length===0
          ? <div style={{ color:C.muted, textAlign:"center", marginTop:60, fontSize:12, letterSpacing:2 }}>SIN SESIONES AÚN</div>
          : closed.map((s,i)=>{
            const p=calcProfit(s);
            return (
              <div key={s.id} className="ani-fadeup" onClick={()=>{ setEditing(s); setView("session"); }}
                style={{ background:C.card, borderLeft:`3px solid ${p>0?C.green:p<0?C.red:C.border}`,
                  padding:"14px 16px", marginBottom:8, cursor:"pointer", animationDelay:`${i*0.04}s`,
                  transition:"background 0.15s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700 }}>{s.venue||"Sin nombre"}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                      {s.date}
                      {stakesLabel(s)&&<span style={{color:C.gold}}> · {stakesLabel(s)}</span>}
                      {s.players&&` · ${s.players} jug.`}
                      {s.rebuys.length>0&&` · ${s.rebuys.length} rc.`}
                    </div>
                  </div>
                  <div style={{ fontSize:18, fontWeight:700, color:p>0?C.green:p<0?C.red:C.muted }}>
                    {p>=0?"+":""}{p.toFixed(2)}€
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      <NavBar active="history" />
    </div>
  );

  // ─── CHART ───
  if (view==="chart") {
    const Tip = ({active,payload,label}: {active?: boolean; payload?: {value: number}[]; label?: string}) => {
      if(!active||!payload?.length) return null;
      const v=payload[0].value;
      return <div style={{background:C.card,border:`1px solid ${C.border}`,padding:"8px 12px",fontFamily:"'Courier New',monospace",fontSize:12}}>
        <div style={{color:C.muted,marginBottom:4}}>{label}</div>
        <div style={{color:v>=0?C.green:C.red,fontWeight:700}}>{v>=0?"+":""}{v.toFixed(2)}€</div>
      </div>;
    };
    const byStakes = closed.reduce((acc: Record<string,{p:number,n:number}>,s)=>{
      const k=stakesLabel(s)||"—";
      if(!acc[k]) acc[k]={p:0,n:0};
      acc[k].p+=calcProfit(s); acc[k].n+=1; return acc;
    },{});

    return (
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Courier New',monospace", color:C.text, maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column" }}>
        <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:16, fontWeight:700, letterSpacing:4, color:C.gold }}>♣ EVOLUCIÓN</span>
          <span style={{ fontSize:9, color:C.muted, letterSpacing:2 }}>P&L ACUMULADO</span>
        </div>
        {closed.length<2
          ? <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontSize:12, letterSpacing:2, textAlign:"center" }}>
              NECESITAS AL MENOS<br/>2 SESIONES CERRADAS
            </div>
          : <>
            <div className="ani-fadeup" style={{ textAlign:"center", padding:"24px 0 8px" }}>
              <div style={{ fontSize:52, fontWeight:700, letterSpacing:-2, color:totalP>0?C.green:totalP<0?C.red:C.gold }}>
                {totalP>=0?"+":""}{totalP.toFixed(2)}€
              </div>
              <div style={{ fontSize:9, color:C.muted, letterSpacing:3, marginTop:6 }}>EN {closed.length} SESIONES</div>
            </div>
            <div style={{ padding:"8px 0 16px" }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{left:8,right:20,top:8,bottom:8}}>
                  <XAxis dataKey="x" tick={{fill:C.muted,fontSize:9,fontFamily:"Courier New"}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:C.muted,fontSize:9,fontFamily:"Courier New"}} axisLine={false} tickLine={false}
                    tickFormatter={v=>(v>=0?"+":"")+v+"€"} />
                  <Tooltip content={<Tip/>} />
                  <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="v" stroke={totalP>=0?C.green:C.red} strokeWidth={2}
                    dot={{r:3,fill:totalP>=0?C.green:C.red,strokeWidth:0}} activeDot={{r:5}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding:"0 20px 20px" }}>
              <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>Por stakes</div>
              {Object.entries(byStakes).map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"10px 0", borderBottom:`1px solid ${C.felt}` }}>
                  <div>
                    <span style={{ fontSize:13, fontWeight:700 }}>{k}</span>
                    <span style={{ fontSize:11, color:C.muted, marginLeft:8 }}>{v.n} ses.</span>
                  </div>
                  <span style={{ fontWeight:700, color:v.p>0?C.green:v.p<0?C.red:C.muted }}>
                    {v.p>=0?"+":""}{v.p.toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          </>}
        <NavBar active="chart" />
      </div>
    );
  }

  return null;
}
