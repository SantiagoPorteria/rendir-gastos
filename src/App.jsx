import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://logxraqrwfqfoxtfbcxk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZ3hyYXFyd2ZxZm94dGZiY3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTQ4NTgsImV4cCI6MjA5NTk3MDg1OH0.BPFO7nxSR909KA4pykw9ofLLVzRdd-3jlSgqQt7Gztw";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Guest session (for temporary group members)
const GUEST_SESSION_KEY = "rendir_guest_session";
function getGuestSession() { try { return JSON.parse(localStorage.getItem(GUEST_SESSION_KEY)||"null"); } catch { return null; } }
function setGuestSession(data) { localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(data)); }
function clearGuestSession() { localStorage.removeItem(GUEST_SESSION_KEY); }

const PALETTE = ["#1a5276","#1a7a4a","#7d3c98","#b7770d","#c0392b","#2e86c1","#17a589","#d35400","#839192","#2c3e50"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CURRENCIES = [
  {code:"CLP",label:"Peso chileno",symbol:"$"},
  {code:"USD",label:"Dólar USA",symbol:"US$"},
  {code:"EUR",label:"Euro",symbol:"€"},
  {code:"ISK",label:"Corona islandesa",symbol:"ISK"},
  {code:"ARS",label:"Peso argentino",symbol:"AR$"},
  {code:"BRL",label:"Real brasileño",symbol:"R$"},
  {code:"PEN",label:"Sol peruano",symbol:"S/"},
];

async function getExchangeRate(fromCurrency) {
  if(fromCurrency==="CLP") return 1;
  try {
    const res = await fetch(`/api/exchange-rate?base=${fromCurrency}`);
    const data = await res.json();
    return data?.conversion_rates?.CLP || null;
  } catch(e) {
    return null;
  }
}

const DEFAULT_CATEGORIES = ["Bencina","Almuerzos","Cafetería","Gastos Oficina","Peajes","Estacionamientos","Supermercado","Restaurantes","Clientes","Merchandising","Eventos","Otro"];
const ENTITY_ICONS = ["🏢","🏗️","🏠","🚗","✈️","🎉","🤝","💼","🏪","⚽","🎨","📦","🥩","🍺","⛳","🧳","🎯","🏖️","🎸","🍕","🏔️","🎲","🚢","🏕️","🎾","🏋️","🎂","🍻","🌴","💻","🏊"];

const ENTITY_LOGOS = {
  "porteria":  "https://logxraqrwfqfoxtfbcxk.supabase.co/storage/v1/object/public/Logos/porteria-icon.png",
  "bl_activos":"https://logxraqrwfqfoxtfbcxk.supabase.co/storage/v1/object/public/Logos/isotipo%20verde.png",
};
const getEntityLogo = (ent) => {
  if(!ent) return null;
  if(ent.logo_url) return ent.logo_url;
  if(ENTITY_LOGOS[ent.id]) return ENTITY_LOGOS[ent.id];
  const lbl = (ent.label||"").toLowerCase();
  if(lbl.includes("porteria")||lbl.includes("portería")) return ENTITY_LOGOS["porteria"];
  if(lbl.includes("bl")||lbl.includes("activo")) return ENTITY_LOGOS["bl_activos"];
  return null;
};
function EntityIcon({entity, size=32}) {
  const logo = getEntityLogo(entity);
  if(logo) return <img src={logo} alt={entity?.label||""} style={{width:size,height:size,objectFit:"contain",borderRadius:6,background:"transparent"}}/>;
  return <span style={{fontSize:size*0.82,lineHeight:1}}>{entity?.icon||"📁"}</span>;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const clp     = n  => "$" + Math.round(Number(n)||0).toLocaleString("es-CL");
const iso2d   = s  => { if(!s)return""; const[y,m,d]=s.split("-"); return`${d}/${m}/${y}`; };
const todayFn = () => new Date().toISOString().split("T")[0];
const ym2label= ym => { if(!ym)return""; const[y,m]=ym.split("-"); return`${MONTH_NAMES[parseInt(m)-1]} ${y}`; };

async function loadScript(src) {
  return new Promise((res,rej) => {
    if(document.querySelector(`script[src="${src}"]`)){res();return;}
    const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej;
    document.head.appendChild(s);
  });
}

async function analyzeReceipt(base64, mediaType) {
  const res = await fetch("/api/analyze", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({base64, mediaType})
  });
  const data = await res.json();
  const text = (data.content||[]).map(c=>c.text||"").join("");
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Badge({color,children}) {
  return <span style={{background:color+"20",color,border:`1px solid ${color}40`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,whiteSpace:"nowrap",display:"inline-block"}}>{children}</span>;
}
function TopBar({title,onBack,right}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"20px 0 16px"}}>
      {onBack&&<button onClick={onBack} style={{background:"none",border:"none",color:"#1a5276",fontWeight:700,cursor:"pointer",fontSize:15,padding:0,fontFamily:"inherit"}}>← Volver</button>}
      <div style={{fontFamily:"'Georgia',serif",fontSize:20,fontWeight:700,color:"#111",flex:1}}>{title}</div>
      {right}
    </div>
  );
}
function Spinner({text="Cargando…"}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:16}}>
      <div style={S.spinner}/>
      <div style={{fontSize:14,color:"#888"}}>{text}</div>
    </div>
  );
}

// ─── GUEST SELECT SCREEN ────────────────────────────────────────────────────
function GuestSelectScreen({entity, onSelect}) {
  const [guests,setGuests] = useState([]);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    if(!entity) return;
    supabase.from("group_guests").select("*").eq("entity_id",entity.id).order("nombre").then(({data})=>{
      setGuests(data||[]);
      setLoading(false);
    });
  },[entity?.id]);

  if(loading) return <Spinner text="Cargando participantes..."/>;

  return (
    <div style={{minHeight:"100vh",background:"#f7f5f0",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:400,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:8}}>{entity?.icon||"👥"}</div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:22,fontWeight:700}}>{entity?.label}</div>
          <div style={{fontSize:14,color:"#888",marginTop:6}}>¿Quién eres?</div>
        </div>

        {guests.length===0 ? (
          <div style={{textAlign:"center",color:"#bbb",padding:"20px 0"}}>
            <div style={{fontSize:36,marginBottom:8}}>😕</div>
            <div>No hay participantes en este grupo todavía.</div>
            <div style={{fontSize:12,marginTop:6}}>Pídele al organizador que te agregue.</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {guests.map(g=>(
              <button key={g.id} onClick={()=>onSelect(g)}
                style={{padding:"14px 18px",borderRadius:12,border:"2px solid #e0e0e0",background:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:16,fontWeight:700,color:"#333",textAlign:"left",transition:"all .15s"}}
                onMouseEnter={e=>e.target.style.borderColor="#1a5276"}
                onMouseLeave={e=>e.target.style.borderColor="#e0e0e0"}>
                👤 {g.nombre}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({onAuth}) {
  const [mode,setMode]   = useState("login");
  const [email,setEmail] = useState("");
  const [pass,setPass]   = useState("");
  const [nombre,setNombre]=useState("");
  const [err,setErr]     = useState(null);
  const [loading,setLoading]=useState(false);

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      if(mode==="login") {
        const {data,error} = await supabase.auth.signInWithPassword({email,password:pass});
        if(error) throw error;
        onAuth(data.user);
      } else {
        const {data,error} = await supabase.auth.signUp({
          email, password:pass,
          options:{data:{nombre}}
        });
        if(error) throw error;
        // Always show confirm message - Supabase requires email confirmation
        setErr("__confirm__");
        return;
      }
    } catch(e){ setErr(e.message); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"#f7f5f0",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:20,padding:32,width:"100%",maxWidth:380,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:8}}>💼</div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:26,fontWeight:700,color:"#111"}}>RendirGastos</div>
          <div style={{fontSize:13,color:"#999",marginTop:4}}>Gestión inteligente de gastos</div>
        </div>

        {mode==="register"&&(
          <div style={S.group}>
            <div style={S.label}>Nombre</div>
            <input style={S.input} value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre"/>
          </div>
        )}
        <div style={S.group}>
          <div style={S.label}>Email</div>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/>
        </div>
        <div style={S.group}>
          <div style={S.label}>Contraseña</div>
          <input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>

        {err&&err!=="__confirm__"&&<div style={{background:"#fde8e8",color:"#b00020",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13}}>{err}</div>}
        {err==="__confirm__"&&(
          <div style={{background:"#e8f5e9",border:"1px solid #a8d5bc",borderRadius:12,padding:"16px",marginBottom:12,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>📧</div>
            <div style={{fontWeight:700,fontSize:15,color:"#1a7a4a",marginBottom:6}}>¡Revisá tu email!</div>
            <div style={{fontSize:13,color:"#555"}}>Te enviamos un link de confirmación a <strong>{email}</strong>. Confirmá tu cuenta y luego volvé a entrar.</div>
          </div>
        )}

        <button onClick={submit} disabled={loading} style={{...S.btn,opacity:loading?0.6:1}}>
          {loading?"Cargando…":mode==="login"?"Entrar":"Crear cuenta"}
        </button>

        <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>
          {mode==="login"
            ? <span>¿No tenés cuenta? <button onClick={()=>setMode("register")} style={{background:"none",border:"none",color:"#1a5276",cursor:"pointer",fontWeight:700,fontSize:13}}>Registrarse</button></span>
            : <span>¿Ya tenés cuenta? <button onClick={()=>setMode("login")} style={{background:"none",border:"none",color:"#1a5276",cursor:"pointer",fontWeight:700,fontSize:13}}>Entrar</button></span>
          }
        </div>
        {mode==="login"&&(
          <div style={{marginTop:16,background:"#f0f7ff",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:12,color:"#555"}}>¿Te invitaron a usar la app?</div>
            <div style={{fontSize:12,color:"#1a5276",fontWeight:600,marginTop:3}}>Registrate con el botón de arriba y luego confirmá tu email.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({profile,entities,expenses,nav,onSignOut,totalUnseen=0,getUnseenCount,markSeen,userId}) {
  const now = new Date();
  const grandTotal = expenses.reduce((s,x)=>s+(x.monto_total||0),0);

  return (
    <div style={S.page}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"24px 0 16px",borderBottom:"1px solid #e8e4df"}}>
        <div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:24,fontWeight:700,color:"#111"}}>RendirGastos</div>
          <div style={{fontSize:13,color:"#999",marginTop:3}}>
            {MONTH_NAMES[now.getMonth()]} {now.getFullYear()} · {profile?.nombre||profile?.email}
            {profile?.role==="admin"&&<span style={{marginLeft:6,background:"#1a5276",color:"#fff",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>ADMIN</span>}
          </div>
        </div>
        <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
          {totalUnseen>0&&(
            <div style={{display:"flex",alignItems:"center",gap:4,background:"#fde8e8",borderRadius:10,padding:"3px 10px"}}>
              <span style={{fontSize:14}}>🔔</span>
              <span style={{fontSize:12,fontWeight:700,color:"#b00020"}}>{totalUnseen} nuevo{totalUnseen!==1?"s":""}</span>
            </div>
          )}
          <div style={{fontSize:11,color:"#aaa"}}>Total mes</div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:20,fontWeight:700,color:"#1a5276"}}>{clp(grandTotal)}</div>
        </div>
      </div>

      {/* Entity cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"18px 0"}}>
        {entities.map(e=>{
          const tot=expenses.filter(x=>x.entity_id===e.id).reduce((s,x)=>s+(x.monto_total||0),0);
          const cnt=expenses.filter(x=>x.entity_id===e.id).length;
          const typeTag = e.type==="group"?"👥":e.type==="global"?"🌐":"";
          return (
            <div key={e.id} onClick={()=>{if(markSeen)markSeen(e.id);e.type==="group"?nav("groupSplit",{entityId:e.id}):nav("entityExpenses",{entityId:e.id});}}
              style={{background:e.color+"12",border:`1.5px solid ${e.color}33`,borderRadius:14,padding:"14px 12px",cursor:"pointer"}}>
              <div style={{marginBottom:6,display:"flex",alignItems:"center",justifyContent:"flex-start"}}><EntityIcon entity={e} size={32}/></div>
              <div style={{fontSize:11,fontWeight:700,color:e.color,lineHeight:1.2,marginBottom:4}}>
                {e.label} {typeTag&&<span style={{fontSize:10}}>{typeTag}</span>}
              </div>
              <div style={{fontFamily:"'Georgia',serif",fontSize:17,fontWeight:700,color:e.color}}>{clp(tot)}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                <div style={{fontSize:11,color:"#aaa"}}>{cnt} gasto{cnt!==1?"s":""}</div>
                {getUnseenCount&&getUnseenCount(e.id)>0&&(
                  <div style={{background:"#c0392b",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                    {getUnseenCount(e.id)} nuevo{getUnseenCount(e.id)!==1?"s":""}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add entity card */}
        <div onClick={()=>nav("newEntity")}
          style={{background:"#f5f5f5",border:"1.5px dashed #ddd",borderRadius:14,padding:"14px 12px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}>
          <div style={{fontSize:26,color:"#ccc"}}>+</div>
          <div style={{fontSize:11,fontWeight:700,color:"#bbb"}}>Nueva entidad</div>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <button style={S.btn} onClick={()=>nav("capture")}>+ Nuevo gasto</button>
        <button style={S.btnOut} onClick={()=>nav("report",{})}>📊 Reporte</button>
        {profile?.role==="admin"&&<button style={S.btnIcon} onClick={()=>nav("admin")}>👥</button>}
        <button style={S.btnIcon} onClick={()=>nav("settings")}>⚙️</button>
      </div>

      <div style={S.sectionLabel}>Últimos gastos</div>
      {expenses.length===0&&<div style={S.empty}><div style={{fontSize:48}}>📷</div><div>Fotografía tu primer comprobante</div></div>}
      {[...expenses].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,12).map(exp=>{
        const ent=entities.find(e=>e.id===exp.entity_id);
        return (
          <div key={exp.id} style={{...S.card,borderLeft:`4px solid ${ent?.color||"#ccc"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={S.cardTitle}>{exp.categoria||"Sin categoría"}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>
                  {ent&&<Badge color={ent.color}>{ent.icon} {ent.label}</Badge>}
                  {exp.comercio&&<Badge color="#666">{exp.comercio}</Badge>}
                </div>
                <div style={S.meta}>{iso2d(exp.fecha)}{exp.rut_comercio?` · ${exp.rut_comercio}`:""}</div>
              </div>
              <div style={{textAlign:"right",marginLeft:12,flexShrink:0}}>
                <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16,color:ent?.color||"#333"}}>{clp(exp.monto_total)}</div>
                {exp.iva>0&&<div style={{fontSize:10,color:"#bbb"}}>IVA {clp(exp.iva)}</div>}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #eee",textAlign:"center"}}>
        <button onClick={onSignOut} style={{background:"none",border:"none",color:"#aaa",cursor:"pointer",fontSize:13}}>Cerrar sesión</button>
      </div>
      <div style={{height:32}}/>
    </div>
  );
}

// ─── NEW ENTITY ───────────────────────────────────────────────────────────────
function NewEntityScreen({profile,nav,onCreated}) {
  const [form,setForm]=useState({label:"",icon:"📁",color:PALETTE[0],type:"personal"});
  const [err,setErr]=useState(null);
  const [loading,setLoading]=useState(false);
  const upd=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const save = async () => {
    if(!form.label.trim()){setErr("Ingresá un nombre");return;}
    setLoading(true);
    const {data:userData} = await supabase.auth.getUser();
    // Generate invite token for group entities
    const inviteToken = form.type==="group" ? Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2) : null;
    const {data,error} = await supabase.from("entities").insert({
      label:form.label, icon:form.icon, color:form.color,
      type: profile?.role==="admin" ? form.type : form.type==="global"?"personal":form.type,
      owner_id: userData.user.id,
      invite_token: inviteToken,
    }).select().single();
    if(error){setErr(error.message);setLoading(false);return;}
    onCreated(data);
    nav("home");
  };

  return (
    <div style={S.page}>
      <TopBar title="Nueva Entidad" onBack={()=>nav("home")}/>
      {err&&<div style={{background:"#fde8e8",color:"#b00020",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13}}>{err}</div>}

      <div style={S.group}>
        <div style={S.label}>Nombre</div>
        <input style={S.input} value={form.label} onChange={upd("label")} placeholder="ej: Gastos Auto, Viaje Pucón..."/>
      </div>

      <div style={S.row}>
        <div style={{flex:1}}>
          <div style={S.label}>Ícono</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
            {ENTITY_ICONS.map(ic=>(
              <button key={ic} onClick={()=>setForm(f=>({...f,icon:ic}))}
                style={{fontSize:22,background:form.icon===ic?"#e8f0fe":"#f5f5f5",border:form.icon===ic?"2px solid #1a5276":"2px solid transparent",borderRadius:8,width:36,height:36,cursor:"pointer"}}>
                {ic}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{...S.group,marginTop:12}}>
        <div style={S.label}>Color</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
          {PALETTE.map(c=>(
            <div key={c} onClick={()=>setForm(f=>({...f,color:c}))}
              style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #111":"2px solid transparent"}}/>
          ))}
        </div>
      </div>

      <div style={S.group}>
        <div style={S.label}>Tipo</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {type:"personal",label:"Personal",desc:"Solo vos la ves",icon:"🔒"},
            {type:"group",label:"Grupal",desc:"Invitás a otros a compartir gastos",icon:"👥"},
            ...(profile?.role==="admin"?[{type:"global",label:"Global (empresa)",desc:"Visible para usuarios que vos asignes",icon:"🌐"}]:[]),
          ].map(opt=>(
            <button key={opt.type} onClick={()=>setForm(f=>({...f,type:opt.type}))}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,border:`2px solid ${form.type===opt.type?"#1a5276":"#e0e0e0"}`,background:form.type===opt.type?"#e8f0fe":"#fff",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <span style={{fontSize:22}}>{opt.icon}</span>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:form.type===opt.type?"#1a5276":"#333"}}>{opt.label}</div>
                <div style={{fontSize:12,color:"#888"}}>{opt.desc}</div>
              </div>
              {form.type===opt.type&&<span style={{marginLeft:"auto",color:"#1a5276",fontWeight:700}}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      <button style={S.btn} onClick={save} disabled={loading}>{loading?"Guardando…":"Crear entidad"}</button>
      <div style={{height:40}}/>
    </div>
  );
}

// ─── CAPTURE ──────────────────────────────────────────────────────────────────
function CaptureScreen({entities,categories,nav,userId,onSaved}) {
  const [step,setStep]=useState("choose");
  const [imgData,setImgData]=useState(null);
  const [mimeType,setMimeType]=useState("image/jpeg");
  const [aiNote,setAiNote]=useState(null);
  const [err,setErr]=useState(null);
  const [saving,setSaving]=useState(false);
  const [participants,setParticipants]=useState([]);
  const [groupMembers,setGroupMembers]=useState([]);
  const [payer,setPayer]=useState(userId);
  const [moneda,setMoneda]=useState("CLP");
  const [exchangeRate,setExchangeRate]=useState(1);
  const [loadingRate,setLoadingRate]=useState(false);
  const fileRef=useRef();
  const blank={entity_id:"",comercio:"",rut_comercio:"",monto_total:"",monto_neto:"",iva:"",fecha:todayFn(),tipo_documento:"boleta",numero_documento:"",categoria:"Otro",descripcion:"",nota:""};
  const [form,setForm]=useState(blank);
  const upd=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const handleCurrencyChange=async(code)=>{
    setMoneda(code);
    if(code==="CLP"){ setExchangeRate(1); return; }
    setLoadingRate(true);
    const rate=await getExchangeRate(code);
    setExchangeRate(rate||1);
    setLoadingRate(false);
  };

  // Load group members when entity changes
  const loadGroupMembers = async (entityId) => {
    const ent = entities.find(e=>e.id===entityId);
    if(ent?.type!=="group"){
      setGroupMembers([]);setParticipants([]);setPayer(userId);return;
    }
    // Registered members
    const {data:members}=await supabase.from("entity_members").select("user_id").eq("entity_id",entityId);
    const memberIds=[...new Set([...(members||[]).map(m=>m.user_id), ent.owner_id, userId])];
    const {data:profiles}=await supabase.from("profiles").select("id,nombre,email").in("id",memberIds);
    const registered=(profiles||[]).filter((m,i,arr)=>arr.findIndex(x=>x.id===m.id)===i).map(p=>({id:p.id,nombre:p.nombre,email:p.email,isGuest:false}));
    // Guest participants (no account)
    const {data:guests}=await supabase.from("group_guests").select("*").eq("entity_id",entityId);
    const guestList=(guests||[]).map(g=>({id:"guest_"+g.id,nombre:g.nombre,email:null,isGuest:true}));
    const all=[...registered,...guestList];
    setGroupMembers(all);
    setParticipants(all.map(m=>m.id));
    setPayer(userId);
  };

  const handleFile=file=>{
    if(!file)return;
    // Compress image before storing
    const canvas=document.createElement("canvas");
    const img=new Image();
    const objectUrl=URL.createObjectURL(file);
    img.onload=()=>{
      // Max 1200px width/height
      const maxSize=1200;
      let w=img.width, h=img.height;
      if(w>maxSize||h>maxSize){
        if(w>h){h=Math.round(h*maxSize/w);w=maxSize;}
        else{w=Math.round(w*maxSize/h);h=maxSize;}
      }
      canvas.width=w; canvas.height=h;
      canvas.getContext("2d").drawImage(img,0,0,w,h);
      const dataUrl=canvas.toDataURL("image/jpeg",0.85);
      setMimeType("image/jpeg");
      setImgData({base64:dataUrl.split(",")[1],url:dataUrl});
      setStep("preview");
      URL.revokeObjectURL(objectUrl);
    };
    img.src=objectUrl;
  };

  const analyze=async()=>{
    setStep("analyzing"); setErr(null);
    try {
      const result=await analyzeReceipt(imgData.base64,mimeType);
      setAiNote(result.confianza);
      setForm(f=>({...f,
        comercio:result.comercio||"",rut_comercio:result.rut_comercio||"",
        monto_total:result.monto_total||"",monto_neto:result.monto_neto||"",iva:result.iva||"",
        fecha:result.fecha||todayFn(),tipo_documento:result.tipo_documento||"boleta",
        numero_documento:result.numero_documento||"",descripcion:result.descripcion||"",
        categoria:categories.includes(result.categoria_sugerida)?result.categoria_sugerida:"Otro",
      }));
    } catch { setErr("No se pudo leer el comprobante. Revisá los datos."); }
    setStep("form");
  };

  const save=async()=>{
    if(!form.entity_id){setErr("Seleccioná la entidad");return;}
    if(!form.monto_total){setErr("Ingresá el monto total");return;}
    const selectedEntity = entities.find(e=>e.id===form.entity_id);
    if(selectedEntity?.type==="group" && participants.length===0){setErr("Seleccioná al menos un participante");return;}
    setSaving(true);
    let image_url=null;
    // Upload image to Supabase Storage
    if(imgData){
      const filename=`${userId}/${Date.now()}.jpg`;
      const blob=await fetch(imgData.url).then(r=>r.blob());
      const {data:uploadData,error:uploadError}=await supabase.storage.from("comprobantes").upload(filename,blob,{contentType:"image/jpeg"});
      if(!uploadError){
        const {data:urlData}=supabase.storage.from("comprobantes").getPublicUrl(filename);
        image_url=urlData.publicUrl;
      }
    }
    const montoOriginal=parseInt(String(form.monto_total).replace(/\D/g,""))||0;
    const montoEnCLP=moneda==="CLP"?montoOriginal:Math.round(montoOriginal*exchangeRate);
    // Determine payer: registered user or guest
    const payerIsGuest = typeof payer === "string" && payer.startsWith("guest_");
    const payerUserId = payerIsGuest ? null : (groupMembers.length>0?payer:userId);
    const payerGuestId = payerIsGuest ? payer.replace("guest_","") : null;
    const {data,error}=await supabase.from("expenses").insert({
      entity_id:form.entity_id, user_id:payerUserId, payer_guest_id:payerGuestId,
      comercio:form.comercio, rut_comercio:form.rut_comercio,
      monto_total:montoEnCLP,
      monto_neto:moneda==="CLP"?(parseInt(String(form.monto_neto).replace(/\D/g,""))||0):Math.round((parseInt(String(form.monto_neto).replace(/\D/g,""))||0)*exchangeRate),
      iva:moneda==="CLP"?(parseInt(String(form.iva).replace(/\D/g,""))||0):Math.round((parseInt(String(form.iva).replace(/\D/g,""))||0)*exchangeRate),
      fecha:form.fecha, tipo_documento:form.tipo_documento,
      numero_documento:form.numero_documento, categoria:form.categoria,
      descripcion:form.descripcion, nota:form.nota, image_url,
      moneda:moneda, monto_original:montoOriginal, tipo_cambio:exchangeRate,
    }).select().single();
    if(error){setErr(error.message);setSaving(false);return;}
    // Save participants for group expenses (handle both registered users and guests)
    if(participants.length>0 && data?.id) {
      const participantRows = participants.map(pid=>{
        const isGuest = typeof pid === "string" && pid.startsWith("guest_");
        return isGuest
          ? {expense_id:data.id, user_id:null, guest_id:pid.replace("guest_","")}
          : {expense_id:data.id, user_id:pid, guest_id:null};
      });
      await supabase.from("expense_participants").insert(participantRows);
    }
    onSaved(data);
    nav("home");
  };

  if(step==="choose") return (
    <div style={S.page}>
      <TopBar title="Nuevo Gasto" onBack={()=>nav("home")}/>
      <div style={{textAlign:"center",padding:"36px 0 28px"}}>
        <div style={{fontSize:68}}>📷</div>
        <div style={{fontFamily:"'Georgia',serif",fontSize:22,fontWeight:700,margin:"12px 0 6px"}}>Fotografía el comprobante</div>
        <div style={{color:"#999",fontSize:14}}>La IA extrae monto, IVA, fecha, comercio y RUT</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <button style={S.btn} onClick={()=>fileRef.current.click()}>📸 Tomar foto / Subir imagen</button>
        <button style={S.btnOut} onClick={()=>setStep("form")}>✏️ Ingresar manualmente</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
    </div>
  );

  if(step==="preview") return (
    <div style={S.page}>
      <TopBar title="Comprobante" onBack={()=>setStep("choose")}/>
      <img src={imgData.url} alt="comprobante" style={{width:"100%",maxHeight:300,objectFit:"contain",borderRadius:12,background:"#eee",marginBottom:16}}/>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <button style={S.btn} onClick={analyze}>🤖 Analizar con IA</button>
        <button style={S.btnOut} onClick={()=>setStep("form")}>✏️ Ingresar manualmente</button>
      </div>
    </div>
  );

  if(step==="analyzing") return <Spinner text="Analizando comprobante… extrayendo datos con IA"/>;

  return (
    <div style={S.page}>
      <TopBar title="Clasificar Gasto" onBack={()=>setStep(imgData?"preview":"choose")}/>
      {imgData&&<img src={imgData.url} alt="" style={{width:"100%",maxHeight:110,objectFit:"contain",borderRadius:10,background:"#f0f0f0",marginBottom:12}}/>}
      {aiNote&&<div style={{borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,fontWeight:600,background:aiNote==="alta"?"#e8f5e9":"#fff8e1",color:aiNote==="alta"?"#2e7d32":"#e65100"}}>{aiNote==="alta"?"✅":"⚠️"} Confianza {aiNote} — verificá antes de guardar.</div>}
      {err&&<div style={{background:"#fde8e8",color:"#b00020",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,fontWeight:600}}>{err}</div>}

      <div style={S.group}>
        <div style={S.label}>¿A qué entidad corresponde? *</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {entities.map(e=>(
            <button key={e.id} onClick={()=>{setForm(f=>({...f,entity_id:e.id}));loadGroupMembers(e.id);}}
              style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderRadius:12,border:`2px solid ${form.entity_id===e.id?e.color:"#e0e0e0"}`,background:form.entity_id===e.id?e.color+"15":"#fff",cursor:"pointer",fontFamily:"inherit"}}>
              <EntityIcon entity={e} size={28}/>
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{fontWeight:700,color:e.color,fontSize:14}}>{e.label}</div>
                <div style={{fontSize:11,color:"#aaa"}}>{e.type==="group"?"Grupal":e.type==="global"?"Global":"Personal"}</div>
              </div>
              {form.entity_id===e.id&&<span style={{color:e.color,fontWeight:700}}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Tipo doc</div><select style={S.input} value={form.tipo_documento} onChange={upd("tipo_documento")}>{["boleta","factura","ticket","recibo","otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        <div style={{flex:1}}><div style={S.label}>N° doc</div><input style={S.input} value={form.numero_documento} onChange={upd("numero_documento")} placeholder="00123456"/></div>
      </div>
      <div style={S.group}><div style={S.label}>Comercio</div><input style={S.input} value={form.comercio} onChange={upd("comercio")} placeholder="ej: Copec, Sodimac..."/></div>
      <div style={S.group}><div style={S.label}>RUT comercio</div><input style={S.input} value={form.rut_comercio} onChange={upd("rut_comercio")} placeholder="ej: 76.123.456-7"/></div>

      <div style={S.group}>
        <div style={S.label}>Moneda</div>
        <select style={S.input} value={moneda} onChange={e=>handleCurrencyChange(e.target.value)}>
          {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}
        </select>
        {moneda!=="CLP"&&(
          <div style={{fontSize:12,color:"#888",marginTop:6}}>
            {loadingRate?"Buscando tipo de cambio...":`1 ${moneda} = ${clp(exchangeRate)} (hoy)`}
          </div>
        )}
      </div>

      <div style={S.row}>
        <div style={{flex:1}}>
          <div style={S.label}>Neto ({moneda})</div>
          <input style={S.input} type="number" value={form.monto_neto}
            onChange={e=>{
              const neto=parseInt(e.target.value)||0;
              const iva=Math.round(neto*0.19);
              const total=neto+iva;
              setForm(f=>({...f,monto_neto:e.target.value,iva:iva||"",monto_total:total||""}));
            }} placeholder="0"/>
        </div>
        <div style={{flex:1}}>
          <div style={S.label}>IVA (19% auto)</div>
          <input style={{...S.input,background:"#f9f9f9"}} type="number" value={form.iva}
            onChange={e=>{
              const iva=parseInt(e.target.value)||0;
              const neto=parseInt(String(form.monto_neto))||0;
              setForm(f=>({...f,iva:e.target.value,monto_total:(neto+iva)||""}));
            }} placeholder="0"/>
        </div>
      </div>
      <div style={S.group}>
        <div style={S.label}>Monto total * {moneda!=="CLP"&&`(${moneda})`}</div>
        <input style={{...S.input,fontSize:18,fontWeight:700}} type="number" value={form.monto_total}
          onChange={upd("monto_total")} placeholder="0"/>
        {form.monto_neto&&!form.iva&&<div style={{fontSize:11,color:"#aaa",marginTop:4}}>¿Sin IVA? El total es el mismo que el neto.</div>}
        {moneda!=="CLP"&&form.monto_total&&(
          <div style={{background:"#f0f7ff",borderRadius:8,padding:"8px 12px",marginTop:8,fontSize:13,color:"#1a5276"}}>
            Equivale a <strong>{clp(Math.round((parseInt(String(form.monto_total).replace(/[^0-9]/g,""))||0)*exchangeRate))}</strong> CLP
          </div>
        )}
      </div>
      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Fecha</div><input style={S.input} type="date" value={form.fecha} onChange={upd("fecha")}/></div>
        <div style={{flex:1}}><div style={S.label}>Categoría</div><select style={S.input} value={form.categoria} onChange={upd("categoria")}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      {/* Payer + Participants for group entities */}
      {groupMembers.length>0&&(
        <div style={S.group}>
          <div style={S.label}>¿Quién pagó? *</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
            {groupMembers.map(m=>(
              <button key={m.id} onClick={()=>setPayer(m.id)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:`2px solid ${payer===m.id?"#b7770d":"#e0e0e0"}`,background:payer===m.id?"#fff8e1":"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                <span style={{fontSize:18}}>{payer===m.id?"💳":"○"}</span>
                <span style={{fontWeight:600,color:payer===m.id?"#b7770d":"#555",fontSize:14}}>{m.nombre||m.email}</span>
                {m.id===userId&&<span style={{fontSize:11,color:"#aaa"}}>(yo)</span>}
                {m.isGuest&&<span style={{fontSize:10,color:"#7d3c98",background:"#f3e8fc",borderRadius:4,padding:"1px 6px"}}>sin cuenta</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {groupMembers.length>0&&(
        <div style={S.group}>
          <div style={S.label}>¿Quiénes participan en este gasto? *</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {groupMembers.map(m=>{
              const isSelected=participants.includes(m.id);
              return (
                <button key={m.id} onClick={()=>setParticipants(prev=>isSelected?prev.filter(id=>id!==m.id):[...prev,m.id])}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:`2px solid ${isSelected?"#1a5276":"#e0e0e0"}`,background:isSelected?"#e8f0fe":"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                  <span style={{fontSize:18}}>{isSelected?"☑️":"⬜"}</span>
                  <span style={{fontWeight:600,color:isSelected?"#1a5276":"#555",fontSize:14}}>{m.nombre||m.email}</span>
                  {m.isGuest&&<span style={{fontSize:10,color:"#7d3c98",background:"#f3e8fc",borderRadius:4,padding:"1px 6px"}}>sin cuenta</span>}
                </button>
              );
            })}
          </div>
          {participants.length>0&&form.monto_total&&(
            <div style={{background:"#f0f7ff",borderRadius:8,padding:"8px 12px",marginTop:8,fontSize:13,color:"#1a5276"}}>
              Cada uno: <strong>{("$"+Math.round((parseInt(String(form.monto_total).replace(/\D/g,""))||0)/participants.length).toLocaleString("es-CL"))}</strong>
            </div>
          )}
        </div>
      )}
      <div style={S.group}><div style={S.label}>Descripción</div><input style={S.input} value={form.descripcion} onChange={upd("descripcion")} placeholder="Breve descripción..."/></div>
      <div style={S.group}><div style={S.label}>Nota</div><textarea style={{...S.input,height:64,resize:"none"}} value={form.nota} onChange={upd("nota")} placeholder="Comentario adicional..."/></div>
      <button style={S.btn} onClick={save} disabled={saving}>{saving?"Guardando…":"💾 Guardar Gasto"}</button>
      <div style={{height:40}}/>
    </div>
  );
}

// ─── REPORT ───────────────────────────────────────────────────────────────────
function ReportScreen({entities,expenses,categories,nav,initParams,onDelete,onUpdate}) {
  const [filterEntity,setFilterEntity]=useState(initParams?.entityId||"all");
  const [filterMonth,setFilterMonth]=useState("all");
  const [deleting,setDeleting]=useState(null);
  const [editing,setEditing]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [exporting,setExporting]=useState(null);

  const allMonths=[...new Set(expenses.map(e=>e.fecha?.slice(0,7)).filter(Boolean))].sort().reverse();

  const startEdit=(exp)=>{
    setEditing(exp.id);
    setEditForm({
      comercio:exp.comercio||"",rut_comercio:exp.rut_comercio||"",
      monto_total:exp.monto_total||"",monto_neto:exp.monto_neto||"",iva:exp.iva||"",
      fecha:exp.fecha||"",tipo_documento:exp.tipo_documento||"boleta",
      numero_documento:exp.numero_documento||"",categoria:exp.categoria||"Otro",
      descripcion:exp.descripcion||"",nota:exp.nota||"",entity_id:exp.entity_id||"",
    });
  };

  const saveEdit=async(expId)=>{
    setSaving(true);
    const {data,error}=await supabase.from("expenses").update({
      comercio:editForm.comercio,rut_comercio:editForm.rut_comercio,
      monto_total:parseInt(String(editForm.monto_total).replace(/\D/g,""))||0,
      monto_neto:parseInt(String(editForm.monto_neto).replace(/\D/g,""))||0,
      iva:parseInt(String(editForm.iva).replace(/\D/g,""))||0,
      fecha:editForm.fecha,tipo_documento:editForm.tipo_documento,
      numero_documento:editForm.numero_documento,categoria:editForm.categoria,
      descripcion:editForm.descripcion,nota:editForm.nota,
    }).eq("id",expId).select().single();
    if(!error&&data) onUpdate(data);
    setSaving(false);
    setEditing(null);
  };

  const updEdit=k=>e=>setEditForm(f=>({...f,[k]:e.target.value}));
  const filtered=expenses.filter(e=>{
    const eOk=filterEntity==="all"||e.entity_id===filterEntity;
    const mOk=filterMonth==="all"||e.fecha?.startsWith(filterMonth);
    return eOk&&mOk;
  });
  const total=filtered.reduce((s,x)=>s+(x.monto_total||0),0);
  const totalIva=filtered.reduce((s,x)=>s+(x.iva||0),0);
  const totalNeto=filtered.reduce((s,x)=>s+(x.monto_neto||0),0);
  const byCat=categories.map(cat=>({cat,total:filtered.filter(e=>e.categoria===cat).reduce((s,x)=>s+(x.monto_total||0),0),count:filtered.filter(e=>e.categoria===cat).length})).filter(x=>x.count>0).sort((a,b)=>b.total-a.total);

  const exportExcel=async()=>{
    setExporting("excel");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    const XLSX=window.XLSX;
    const entLabel=filterEntity==="all"?"Todos":entities.find(e=>e.id===filterEntity)?.label||"";
    const rows=[
      [`RENDICIÓN — ${entLabel} — ${filterMonth==="all"?"Todos los meses":ym2label(filterMonth)}`],[],
      ["#","Fecha","Comercio","RUT","Tipo Doc","N° Doc","Categoría","Entidad","Neto","IVA","Total","Nota"],
    ];
    filtered.forEach((exp,i)=>{
      const ent=entities.find(e=>e.id===exp.entity_id);
      rows.push([i+1,iso2d(exp.fecha),exp.comercio||"",exp.rut_comercio||"",exp.tipo_documento||"",exp.numero_documento||"",exp.categoria||"",ent?.label||"",exp.monto_neto||0,exp.iva||0,exp.monto_total||0,exp.nota||""]);
    });
    rows.push([],["","","","","","","","TOTAL",totalNeto,totalIva,total]);
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"]=[{wch:4},{wch:10},{wch:26},{wch:14},{wch:10},{wch:10},{wch:16},{wch:22},{wch:12},{wch:10},{wch:12},{wch:24}];
    XLSX.utils.book_append_sheet(wb,ws,"Rendición");
    XLSX.writeFile(wb,`Rendicion_${entLabel}_${filterMonth}.xlsx`);
    setExporting(null);
  };

  return (
    <div style={S.page}>
      <TopBar title="Reporte" onBack={()=>nav("home")} right={
        <button onClick={exportExcel} disabled={!!exporting}
          style={{background:"#1a7a4a",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",opacity:exporting?0.6:1}}>
          {exporting?"…":"📊 Excel"}
        </button>
      }/>

      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Entidad</div>
          <select style={S.input} value={filterEntity} onChange={e=>setFilterEntity(e.target.value)}>
            <option value="all">Todas</option>
            {entities.map(e=><option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}
          </select>
        </div>
        <div style={{flex:1}}><div style={S.label}>Período</div>
          <select style={S.input} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
            <option value="all">Todos</option>
            {allMonths.map(m=><option key={m} value={m}>{ym2label(m)}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,margin:"4px 0 16px"}}>
        {[{label:"Total",value:clp(total),color:"#1a5276"},{label:"Neto",value:clp(totalNeto),color:"#1a7a4a"},{label:"IVA",value:clp(totalIva),color:"#7d3c98"}].map(item=>(
          <div key={item.label} style={{background:item.color+"10",border:`1px solid ${item.color}25`,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#aaa",marginBottom:3}}>{item.label}</div>
            <div style={{fontFamily:"'Georgia',serif",fontWeight:700,color:item.color,fontSize:15}}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{background:"#f5f5f5",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#666"}}>{filtered.length} comprobante{filtered.length!==1?"s":""}</div>

      {byCat.length>0&&<>
        <div style={S.sectionLabel}>Por categoría</div>
        {byCat.map(c=>(
          <div key={c.cat} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f0f0f0"}}>
            <span style={{fontSize:14,fontWeight:600}}>{c.cat} <span style={{color:"#ccc",fontWeight:400}}>({c.count})</span></span>
            <span style={{fontFamily:"'Georgia',serif",fontWeight:700}}>{clp(c.total)}</span>
          </div>
        ))}
      </>}

      <div style={{...S.sectionLabel,marginTop:20}}>Comprobantes</div>
      {filtered.length===0&&<div style={S.empty}><div>Sin gastos con estos filtros</div></div>}
      {[...filtered].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(exp=>{
        const ent=entities.find(e=>e.id===exp.entity_id);
        return (
          <div key={exp.id} style={{...S.card,borderLeft:`4px solid ${ent?.color||"#ccc"}`}}>
            <div style={{display:"flex",gap:10}}>
              {exp.image_url&&<img src={exp.image_url} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:8,flexShrink:0}}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={S.cardTitle}>{exp.categoria||"Sin categoría"}{exp.comercio?` · ${exp.comercio}`:""}</div>
                  <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16,color:ent?.color,marginLeft:8,flexShrink:0}}>{clp(exp.monto_total)}</div>
                </div>
                {exp.rut_comercio&&<div style={{fontSize:11,color:"#aaa",marginBottom:3}}>RUT: {exp.rut_comercio}</div>}
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
                  {ent&&<Badge color={ent.color}>{ent.icon} {ent.label}</Badge>}
                  <Badge color="#666">{exp.categoria}</Badge>
                  {exp.tipo_documento&&<Badge color="#999">{exp.tipo_documento}{exp.numero_documento?` N°${exp.numero_documento}`:""}</Badge>}
                </div>
                {exp.descripcion&&<div style={S.desc}>{exp.descripcion}</div>}
                {exp.nota&&<div style={{...S.desc,color:"#bbb"}}>📝 {exp.nota}</div>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                  <div style={S.meta}>{iso2d(exp.fecha)}{exp.iva>0?` · IVA ${clp(exp.iva)}`:""}</div>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>{setEditing(editing===exp.id?null:exp.id);startEdit(exp);}} style={{background:"none",border:"none",color:"#aaa",cursor:"pointer",fontSize:14,padding:"2px 4px"}}>✏️</button>
                    <button onClick={()=>setDeleting(exp.id)} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:14,padding:"2px 4px"}}>🗑️</button>
                  </div>
                </div>
              </div>
            </div>
            {/* EDIT FORM */}
            {editing===exp.id&&(
              <div style={{background:"#f8f9fa",borderRadius:8,padding:"12px",marginTop:8,borderTop:"1px solid #eee"}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#1a5276"}}>✏️ Editar gasto</div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div style={{flex:1}}><div style={S.label}>Comercio</div><input style={S.input} value={editForm.comercio} onChange={updEdit("comercio")}/></div>
                  <div style={{flex:1}}><div style={S.label}>RUT</div><input style={S.input} value={editForm.rut_comercio} onChange={updEdit("rut_comercio")}/></div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div style={{flex:1}}><div style={S.label}>Neto</div><input style={S.input} type="number" value={editForm.monto_neto} onChange={e=>{const n=parseInt(e.target.value)||0;setEditForm(f=>({...f,monto_neto:e.target.value,iva:Math.round(n*0.19)||"",monto_total:Math.round(n*1.19)||""}));}}/></div>
                  <div style={{flex:1}}><div style={S.label}>IVA</div><input style={S.input} type="number" value={editForm.iva} onChange={updEdit("iva")}/></div>
                </div>
                <div style={{marginBottom:8}}><div style={S.label}>Total *</div><input style={{...S.input,fontWeight:700}} type="number" value={editForm.monto_total} onChange={updEdit("monto_total")}/></div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div style={{flex:1}}><div style={S.label}>Fecha</div><input style={S.input} type="date" value={editForm.fecha} onChange={updEdit("fecha")}/></div>
                  <div style={{flex:1}}><div style={S.label}>Categoría</div><select style={S.input} value={editForm.categoria} onChange={updEdit("categoria")}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                </div>
                <div style={{marginBottom:8}}><div style={S.label}>Descripción</div><input style={S.input} value={editForm.descripcion} onChange={updEdit("descripcion")}/></div>
                <div style={{marginBottom:10}}><div style={S.label}>Nota</div><input style={S.input} value={editForm.nota} onChange={updEdit("nota")}/></div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>saveEdit(exp.id)} disabled={saving} style={{flex:1,background:"#1a5276",color:"#fff",border:"none",borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{saving?"Guardando...":"💾 Guardar"}</button>
                  <button onClick={()=>setEditing(null)} style={{flex:1,background:"#eee",border:"none",borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Cancelar</button>
                </div>
              </div>
            )}
            {/* DELETE */}
            {deleting===exp.id&&(
              <div style={{background:"#fde8e8",borderRadius:8,padding:"10px",marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,color:"#b00020",flex:1}}>¿Eliminar este gasto?</span>
                <button onClick={async()=>{await supabase.from("expenses").delete().eq("id",exp.id);onDelete(exp.id);setDeleting(null);}}
                  style={{background:"#b00020",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Eliminar</button>
                <button onClick={()=>setDeleting(null)} style={{background:"#eee",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Cancelar</button>
              </div>
            )}
          </div>
        );
      })}
      <div style={{height:40}}/>
    </div>
  );
}

// ─── GUEST MANAGER INLINE ────────────────────────────────────────────────────
function GuestManagerInline({entityId}) {
  const [guests,setGuests] = useState([]);
  const [newName,setNewName] = useState("");
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    supabase.from("group_guests").select("*").eq("entity_id",entityId).order("nombre").then(({data})=>{
      setGuests(data||[]);
      setLoading(false);
    });
  },[entityId]);

  const addGuest = async () => {
    if(!newName.trim()) return;
    const {data,error} = await supabase.from("group_guests").insert({entity_id:entityId,nombre:newName.trim()}).select().single();
    if(!error&&data){ setGuests(g=>[...g,data]); setNewName(""); }
  };

  const removeGuest = async (id) => {
    await supabase.from("group_guests").delete().eq("id",id);
    setGuests(g=>g.filter(x=>x.id!==id));
  };

  if(loading) return <div style={{fontSize:12,color:"#aaa",padding:"8px 0"}}>Cargando...</div>;

  return (
    <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #e0e0e0"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
        👤 Participantes sin cuenta
      </div>
      {guests.map(g=>(
        <div key={g.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f8f8f8"}}>
          <div style={{fontWeight:600,fontSize:13}}>👤 {g.nombre}</div>
          <button onClick={()=>removeGuest(g.id)} style={{background:"#fde8e8",color:"#b00020",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Eliminar</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <input style={{flex:1,border:"1.5px solid #e0e0e0",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit"}}
          value={newName} onChange={e=>setNewName(e.target.value)}
          placeholder="Nombre del participante..."
          onKeyDown={e=>e.key==="Enter"&&addGuest()}/>
        <button onClick={addGuest} style={{background:"#1a5276",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}}>+</button>
      </div>
    </div>
  );
}

// ─── ADMIN SCREEN ─────────────────────────────────────────────────────────────
function AdminScreen({entities,nav}) {
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [memberships,setMemberships]=useState({});

  useEffect(()=>{
    (async()=>{
      const {data}=await supabase.from("profiles").select("*");
      setUsers(data||[]);
      const {data:mem}=await supabase.from("entity_members").select("*");
      const map={};
      (mem||[]).forEach(m=>{
        if(!map[m.user_id])map[m.user_id]=[];
        map[m.user_id].push(m.entity_id);
      });
      setMemberships(map);
      setLoading(false);
    })();
  },[]);

  const toggleAccess=async(userId,entityId,hasAccess)=>{
    if(hasAccess){
      const {error}=await supabase.from("entity_members").delete().eq("user_id",userId).eq("entity_id",entityId);
      if(error){alert("Error al quitar acceso: "+error.message);return;}
      setMemberships(m=>({...m,[userId]:(m[userId]||[]).filter(id=>id!==entityId)}));
    } else {
      const {error}=await supabase.from("entity_members").insert({user_id:userId,entity_id:entityId,can_write:true});
      if(error){alert("Error al dar acceso: "+error.message);return;}
      setMemberships(m=>({...m,[userId]:[...(m[userId]||[]),entityId]}));
    }
  };

  const globalEntities=entities.filter(e=>e.type==="global");
  const groupEntities=entities.filter(e=>e.type==="group");
  const [adminTab,setAdminTab]=useState("global"); // global | groups
  const [groupMembers,setGroupMembers]=useState({});

  useEffect(()=>{
    if(groupEntities.length===0)return;
    (async()=>{
      const {data:mem}=await supabase.from("entity_members").select("*").in("entity_id",groupEntities.map(e=>e.id));
      const map={};
      (mem||[]).forEach(m=>{if(!map[m.entity_id])map[m.entity_id]=[];map[m.entity_id].push(m.user_id);});
      setGroupMembers(map);
    })();
  },[groupEntities.length]);

  const toggleGroupAccess=async(userId,entityId,hasAccess)=>{
    if(hasAccess){
      await supabase.from("entity_members").delete().eq("user_id",userId).eq("entity_id",entityId);
      setGroupMembers(m=>({...m,[entityId]:(m[entityId]||[]).filter(id=>id!==userId)}));
    } else {
      const {error}=await supabase.from("entity_members").insert({user_id:userId,entity_id:entityId,can_write:true});
      if(error){alert("Error: "+error.message);return;}
      setGroupMembers(m=>({...m,[entityId]:[...(m[entityId]||[]),userId]}));
    }
  };

  if(loading) return <Spinner text="Cargando usuarios…"/>;

  return (
    <div style={S.page}>
      <TopBar title="Gestión de Usuarios" onBack={()=>nav("home")}/>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["global","🌐 Globales"],["groups","👥 Grupos"]].map(([t,label])=>(
          <button key={t} onClick={()=>setAdminTab(t)} style={{flex:1,padding:"9px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,background:adminTab===t?"#1a5276":"#f0f0f0",color:adminTab===t?"#fff":"#555",fontFamily:"inherit"}}>{label}</button>
        ))}
      </div>

      {adminTab==="global"&&<div style={{background:"#f0f7ff",border:"1px solid #bee3f8",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1a5276"}}>
        Asignás qué entidades globales puede ver cada usuario.
      </div>}

      {adminTab==="groups"&&(
        <div>
          <div style={{background:"#f0fff4",border:"1px solid #a8d5bc",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1a7a4a"}}>
            Agregá o quitá usuarios de los grupos sin que usen el link.
          </div>
          {groupEntities.map(ent=>(
            <div key={ent.id} style={{...S.card,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingBottom:10,borderBottom:"1px solid #f0f0f0"}}>
                <EntityIcon entity={ent} size={28}/>
                <div style={{fontWeight:700,fontSize:15,color:ent.color}}>{ent.label}</div>
                <div style={{marginLeft:"auto",fontSize:12,color:"#aaa"}}>{(groupMembers[ent.id]||[]).length} miembros</div>
              </div>
              {/* Registered users */}
              {users.filter(u=>u.id!==ent.owner_id).map(user=>{
                const hasAccess=(groupMembers[ent.id]||[]).includes(user.id);
                return (
                  <div key={user.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f8f8f8"}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>{user.nombre||"Sin nombre"} <span style={{fontSize:10,color:"#aaa"}}>cuenta</span></div>
                      <div style={{fontSize:11,color:"#aaa"}}>{user.email}</div>
                    </div>
                    <button onClick={()=>toggleGroupAccess(user.id,ent.id,hasAccess)}
                      style={{background:hasAccess?"#1a7a4a":"#f0f0f0",color:hasAccess?"#fff":"#555",border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>
                      {hasAccess?"✓ En grupo":"+ Agregar"}
                    </button>
                  </div>
                );
              })}
              {/* Guest participants */}
              <GuestManagerInline entityId={ent.id}/>
            </div>
          ))}
        </div>
      )}

      {adminTab==="global"&&users.map(user=>(
        <div key={user.id} style={{...S.card,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"#1a5276",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14}}>
              {(user.nombre||user.email||"?")[0].toUpperCase()}
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{user.nombre||"Sin nombre"}</div>
              <div style={{fontSize:12,color:"#888"}}>{user.email}</div>
            </div>
            <div style={{marginLeft:"auto"}}>
              <span style={{background:user.role==="admin"?"#1a5276":"#f0f0f0",color:user.role==="admin"?"#fff":"#555",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                {user.role==="admin"?"ADMIN":"USER"}
              </span>
            </div>
          </div>
          {globalEntities.length===0&&<div style={{fontSize:12,color:"#bbb"}}>No hay entidades globales creadas aún.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {globalEntities.map(ent=>{
              const hasAccess=(memberships[user.id]||[]).includes(ent.id);
              return (
                <div key={ent.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",background:"#f9f9f9",borderRadius:8}}>
                  <span style={{fontSize:13}}>{ent.icon} {ent.label}</span>
                  <button onClick={()=>toggleAccess(user.id,ent.id,hasAccess)}
                    style={{background:hasAccess?"#1a7a4a":"#eee",color:hasAccess?"#fff":"#555",border:"none",borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>
                    {hasAccess?"✓ Con acceso":"Sin acceso"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{height:40}}/>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsScreen({profile,entities,categories,nav,dispatch}) {
  const [tab,setTab]=useState("categories");
  const [newCat,setNewCat]=useState("");
  const [userCategories,setUserCategories]=useState(categories.filter(c=>!DEFAULT_CATEGORIES.includes(c)));

  const addCat=async()=>{
    if(!newCat.trim())return;
    dispatch({type:"ADD_CATEGORY",payload:newCat.trim()});
    setNewCat("");
  };

  return (
    <div style={S.page}>
      <TopBar title="Configuración" onBack={()=>nav("home")}/>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["categories","🏷️ Categorías"],["entities","🏢 Mis Entidades"]].map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,background:tab===t?"#1a5276":"#f0f0f0",color:tab===t?"#fff":"#555",fontFamily:"inherit"}}>{label}</button>
        ))}
      </div>

      {tab==="categories"&&(
        <>
          <div style={S.sectionLabel}>Categorías</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
            {categories.map(c=>(
              <div key={c} style={{display:"flex",alignItems:"center",gap:4,background:"#f0f0f0",borderRadius:20,padding:"5px 10px 5px 12px"}}>
                <span style={{fontSize:13,fontWeight:600}}>{c}</span>
                {!DEFAULT_CATEGORIES.includes(c)&&(
                  <button onClick={()=>dispatch({type:"REMOVE_CATEGORY",payload:c})} style={{background:"none",border:"none",cursor:"pointer",color:"#bbb",fontSize:15,padding:0,lineHeight:1}}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={S.sectionLabel}>Nueva categoría</div>
          <div style={{display:"flex",gap:8}}>
            <input style={{...S.input,flex:1}} value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="ej: Farmacia, Hotel..."
              onKeyDown={e=>{if(e.key==="Enter")addCat();}}/>
            <button style={{...S.btn,width:"auto",padding:"0 18px"}} onClick={addCat}>+</button>
          </div>
        </>
      )}

      {tab==="entities"&&(
        <>
          <div style={S.sectionLabel}>Tus entidades</div>
          {entities.map(e=>(
            <div key={e.id} style={{...S.card,display:"flex",alignItems:"center",gap:10}}>
              <EntityIcon entity={e} size={26}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:e.color,fontSize:14}}>{e.label}</div>
                <div style={{fontSize:11,color:"#aaa"}}>{e.type==="group"?"👥 Grupal":e.type==="global"?"🌐 Global":"🔒 Personal"}</div>
              </div>
              {e.type!=="global"&&(
                <button onClick={async()=>{await supabase.from("entities").delete().eq("id",e.id);dispatch({type:"REMOVE_ENTITY",payload:e.id});}}
                  style={{background:"#fde8e8",color:"#b00020",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
                  Eliminar
                </button>
              )}
            </div>
          ))}
          <button style={{...S.btn,marginTop:12}} onClick={()=>nav("newEntity")}>+ Nueva entidad</button>
        </>
      )}
      <div style={{height:40}}/>
    </div>
  );
}

// ─── INVITE SCREEN ───────────────────────────────────────────────────────────
function InviteScreen({nav, token}) {
  const [joining,setJoining]=useState(false);
  const [msg,setMsg]=useState(null);
  const [entity,setEntity]=useState(null);
  const [needsAuth,setNeedsAuth]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [nombre,setNombre]=useState("");
  const [authErr,setAuthErr]=useState(null);
  const tokenRef = useRef(null);

  useEffect(()=>{
    const t = token || new URLSearchParams(window.location.search).get("invite");
    if(t){
      tokenRef.current = t;
      processInvite(t);
    }
  },[token]);

  const processInvite = async (token) => {
    setJoining(true);
    // Find entity
    const {data:ent,error}=await supabase.from("entities").select("*").eq("invite_token",token).single();
    if(error||!ent){setMsg({type:"error",text:"Link inválido o expirado."});setJoining(false);return;}
    setEntity(ent);
    // Check if logged in
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setNeedsAuth(true);setJoining(false);return;}
    joinGroup(ent, user);
  };

  const joinGroup = async (ent, user) => {
    setJoining(true);
    // Refresh session to ensure we have valid auth token
    await supabase.auth.refreshSession();
    const {data:existing}=await supabase.from("entity_members").select("id").eq("entity_id",ent.id).eq("user_id",user.id).single();
    if(existing){setMsg({type:"info",text:`Ya sos miembro de "${ent.label}".`});setJoining(false);setTimeout(()=>window.location.href="/",1500);return;}
    const {error:joinError}=await supabase.from("entity_members").insert({entity_id:ent.id,user_id:user.id});
    if(joinError){
      // If still failing, show login form
      if(joinError.message.includes("row-level security")||joinError.message.includes("policy")){
        setNeedsAuth(true);setJoining(false);return;
      }
      setMsg({type:"error",text:"Error al unirse: "+joinError.message});setJoining(false);return;
    }
    setMsg({type:"success",text:`¡Te uniste a "${ent.label}" exitosamente!`});
    setJoining(false);
    setTimeout(()=>window.location.href="/",2000);
  };

  const handleAuth = async () => {
    setAuthErr(null); setJoining(true);
    try {
      let user;
      if(authMode==="login"){
        const {data,error}=await supabase.auth.signInWithPassword({email,password:pass});
        if(error) throw error;
        user=data.user;
      } else {
        const {data,error}=await supabase.auth.signUp({email,password:pass,options:{data:{nombre}}});
        if(error) throw error;
        user=data.user;
      }
      if(user && entity) joinGroup(entity, user);
      else if(!user) {
        // Need email confirmation
        setAuthErr("__confirm__");
      }
    } catch(e){setAuthErr(e.message);setJoining(false);}
  };

  const joinByToken = async (token) => { processInvite(token); };

  if(joining) return (
    <div style={{minHeight:"100vh",background:"#f7f5f0",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
      <div style={S.spinner}/>
      <div style={{fontSize:16,color:"#888"}}>Uniéndote al grupo…</div>
    </div>
  );

  // Need to login/register first
  if(needsAuth && entity && !msg) return (
    <div style={{minHeight:"100vh",background:"#f7f5f0",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:380,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:44,marginBottom:8}}>👥</div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:20,fontWeight:700}}>Unirte a {entity.label}</div>
          <div style={{fontSize:13,color:"#888",marginTop:4}}>
            {authMode==="login"?"Entrá con tu cuenta para unirte":"Creá una cuenta para unirte al grupo"}
          </div>
        </div>
        {authErr&&authErr!=="__confirm__"&&<div style={{background:"#fde8e8",color:"#b00020",borderRadius:10,padding:"10px",marginBottom:12,fontSize:13}}>{authErr}</div>}
        {authErr==="__confirm__"&&(
          <div style={{background:"#e8f5e9",border:"1px solid #a8d5bc",borderRadius:12,padding:"14px",marginBottom:12,textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:6}}>📧</div>
            <div style={{fontWeight:700,fontSize:14,color:"#1a7a4a",marginBottom:4}}>¡Revisá tu email!</div>
            <div style={{fontSize:12,color:"#555"}}>Confirmá tu cuenta y luego volvé a abrir este link para unirte al grupo.</div>
          </div>
        )}
        {authMode==="register"&&(
          <div style={S.group}>
            <div style={S.label}>Nombre</div>
            <input style={S.input} value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre"/>
          </div>
        )}
        <div style={S.group}>
          <div style={S.label}>Email</div>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/>
        </div>
        <div style={S.group}>
          <div style={S.label}>Contraseña</div>
          <input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
        </div>
        <button style={S.btn} onClick={handleAuth}>
          {authMode==="login"?"Entrar y unirme":"Registrarme y unirme"}
        </button>
        <div style={{textAlign:"center",marginTop:14,fontSize:13,color:"#888"}}>
          {authMode==="login"
            ? <span>¿No tenés cuenta? <button onClick={()=>setAuthMode("register")} style={{background:"none",border:"none",color:"#1a5276",cursor:"pointer",fontWeight:700,fontSize:13}}>Registrarse</button></span>
            : <span>¿Ya tenés cuenta? <button onClick={()=>setAuthMode("login")} style={{background:"none",border:"none",color:"#1a5276",cursor:"pointer",fontWeight:700,fontSize:13}}>Entrar</button></span>
          }
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f7f5f0",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:20,padding:32,width:"100%",maxWidth:380,textAlign:"center",boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
        <div style={{fontSize:52,marginBottom:16}}>👥</div>
        {msg ? (
          <>
            <div style={{fontSize:18,fontWeight:700,color:msg.type==="success"?"#1a7a4a":msg.type==="error"?"#b00020":"#1a5276",marginBottom:8}}>
              {msg.type==="success"?"¡Te uniste!":msg.type==="error"?"Error":"Info"}
            </div>
            <div style={{fontSize:14,color:"#666",marginBottom:24}}>{msg.text}</div>
            {msg.type==="success"&&<div style={{fontSize:13,color:"#aaa"}}>Redirigiendo a la app…</div>}
            {msg.type!=="success"&&<button style={S.btn} onClick={()=>nav("home")}>Ir al inicio</button>}
          </>
        ) : (
          <>
            <div style={{fontFamily:"'Georgia',serif",fontSize:22,fontWeight:700,marginBottom:8}}>Invitación a grupo</div>
            <div style={{fontSize:14,color:"#888",marginBottom:24}}>El link de invitación no es válido o ya expiró.</div>
            <button style={S.btn} onClick={()=>nav("home")}>Ir al inicio</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── GROUP SPLIT SCREEN ───────────────────────────────────────────────────────
function GroupSplitScreen({entity,expenses,nav}) {
  const [members,setMembers]=useState([]);
  const [expParticipants,setExpParticipants]=useState({});
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState("detailed");
  const [tab,setTab]=useState("split");
  const [deleting,setDeleting]=useState(null);
  const [editing,setEditing]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [savingEdit,setSavingEdit]=useState(false);

  const groupExpenses=expenses.filter(e=>e.entity_id===entity?.id);

  useEffect(()=>{
    if(!entity)return;
    (async()=>{
      const memberIds_set=new Set([entity.owner_id]);
      const {data:mems}=await supabase.from("entity_members").select("user_id").eq("entity_id",entity.id);
      (mems||[]).forEach(m=>memberIds_set.add(m.user_id));
      const {data:profiles}=await supabase.from("profiles").select("id,nombre,email").in("id",[...memberIds_set]);
      const registered=(profiles||[]).filter((m,i,arr)=>arr.findIndex(x=>x.id===m.id)===i).map(p=>({id:p.id,nombre:p.nombre,email:p.email,isGuest:false}));
      // Guests
      const {data:guests}=await supabase.from("group_guests").select("*").eq("entity_id",entity.id);
      const guestList=(guests||[]).map(g=>({id:"guest_"+g.id,nombre:g.nombre,email:null,isGuest:true}));
      setMembers([...registered,...guestList]);
      const expIds=groupExpenses.map(e=>e.id);
      if(expIds.length>0){
        const {data:parts}=await supabase.from("expense_participants").select("*").in("expense_id",expIds);
        const map={};
        (parts||[]).forEach(p=>{
          if(!map[p.expense_id])map[p.expense_id]=[];
          map[p.expense_id].push(p.guest_id?("guest_"+p.guest_id):p.user_id);
        });
        setExpParticipants(map);
      }
      setLoading(false);
    })();
  },[entity?.id]);

  const calcSplit=()=>{
    const paid={},owes={};
    members.forEach(m=>{paid[m.id]=0;owes[m.id]=0;});
    groupExpenses.forEach(exp=>{
      const parts=expParticipants[exp.id]||members.map(m=>m.id);
      const share=Math.round((exp.monto_total||0)/Math.max(parts.length,1));
      const payerId=exp.payer_guest_id?("guest_"+exp.payer_guest_id):exp.user_id;
      if(paid[payerId]!==undefined) paid[payerId]+=(exp.monto_total||0);
      parts.forEach(uid=>{if(owes[uid]!==undefined)owes[uid]+=share;});
    });
    const balance={};
    members.forEach(m=>{balance[m.id]=(paid[m.id]||0)-(owes[m.id]||0);});
    return {paid,owes,balance};
  };

  const calcSimplified=(balance)=>{
    const c=members.filter(m=>balance[m.id]>0).map(m=>({...m,amt:balance[m.id]})).sort((a,b)=>b.amt-a.amt);
    const d=members.filter(m=>balance[m.id]<0).map(m=>({...m,amt:-balance[m.id]})).sort((a,b)=>b.amt-a.amt);
    const tx=[];
    let ci=0,di=0;
    const cc=c.map(x=>({...x})),dd=d.map(x=>({...x}));
    while(ci<cc.length&&di<dd.length){
      const amt=Math.min(cc[ci].amt,dd[di].amt);
      if(amt>0) tx.push({from:dd[di],to:cc[ci],amount:amt});
      cc[ci].amt-=amt;dd[di].amt-=amt;
      if(cc[ci].amt<=0)ci++;if(dd[di].amt<=0)di++;
    }
    return tx;
  };

  const startEdit=(exp)=>{
    setEditing(exp.id);
    setEditForm({
      participants: expParticipants[exp.id]||null,
      comercio:exp.comercio||"",rut_comercio:exp.rut_comercio||"",monto_total:exp.monto_total||"",monto_neto:exp.monto_neto||"",iva:exp.iva||"",fecha:exp.fecha||"",tipo_documento:exp.tipo_documento||"boleta",numero_documento:exp.numero_documento||"",categoria:exp.categoria||"Otro",descripcion:exp.descripcion||"",nota:exp.nota||""});};
  const saveEdit=async(expId)=>{
    setSavingEdit(true);
    await supabase.from("expenses").update({comercio:editForm.comercio,rut_comercio:editForm.rut_comercio,monto_total:parseInt(String(editForm.monto_total).replace(/[^0-9]/g,""))||0,monto_neto:parseInt(String(editForm.monto_neto).replace(/[^0-9]/g,""))||0,iva:parseInt(String(editForm.iva).replace(/[^0-9]/g,""))||0,fecha:editForm.fecha,tipo_documento:editForm.tipo_documento,numero_documento:editForm.numero_documento,categoria:editForm.categoria,descripcion:editForm.descripcion,nota:editForm.nota}).eq("id",expId);
    // Update participants if changed
    if(editForm.participants){
      await supabase.from("expense_participants").delete().eq("expense_id",expId);
      if(editForm.participants.length>0){
        await supabase.from("expense_participants").insert(editForm.participants.map(uid=>({expense_id:expId,user_id:uid})));
      }
      setExpParticipants(prev=>({...prev,[expId]:editForm.participants}));
    }
    setSavingEdit(false);
    setEditing(null);
  };
  const updEdit=k=>e=>setEditForm(f=>({...f,[k]:e.target.value}));

  const shareWA=()=>{
    if(!entity)return;
    const {paid,owes,balance}=calcSplit();
    const tx=calcSimplified(balance);
    const total=groupExpenses.reduce((s,x)=>s+(x.monto_total||0),0);
    let msg=`💰 *Split — ${entity.label}*
Total: $${total.toLocaleString("es-CL")}

*PAGOS*
`;
    members.forEach(m=>{msg+=`${m.nombre||m.email}: pagó $${(paid[m.id]||0).toLocaleString("es-CL")} / le corresponde $${(owes[m.id]||0).toLocaleString("es-CL")}
`;});
    if(tx.length>0){msg+=`
*TRANSFERENCIAS*
`;tx.forEach(t=>{msg+=`${t.from.nombre||t.from.email} → ${t.to.nombre||t.to.email}: $${t.amount.toLocaleString("es-CL")}
`;});}
    window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank");
  };

  if(loading) return <Spinner text="Calculando split..."/>;
  if(!entity) return null;

  const {paid,owes,balance}=calcSplit();
  const tx=calcSimplified(balance);
  const total=groupExpenses.reduce((s,x)=>s+(x.monto_total||0),0);
  const perPerson=members.length>0?Math.round(total/members.length):0;
  const inviteUrl=`https://rendir-gastos-sli.vercel.app?invite=${entity.invite_token}`;
  const CATS=["Bencina","Almuerzos","Gastos Oficina","Peajes","Estacionamientos","Supermercado","Restaurantes","Clientes","Merchandising","Eventos","Otro"];

  return (
    <div style={S.page}>
      <TopBar title={entity.label} onBack={()=>nav("home")} right={
        <button onClick={shareWA} style={{background:"#25D366",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit"}}>📲 WA</button>
      }/>

      {/* Tab selector */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["split","📊 Split"],["gastos","📋 Gastos"]].map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,background:tab===t?"#1a5276":"#f0f0f0",color:tab===t?"#fff":"#555",fontFamily:"inherit"}}>{label}</button>
        ))}
      </div>

      {/* GASTOS TAB */}
      {tab==="gastos" && (
        <div>
          {groupExpenses.length===0 && <div style={S.empty}><div style={{fontSize:40}}>📋</div><div>Sin gastos todavía</div></div>}
          {[...groupExpenses].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(exp=>{
            const payerId=exp.payer_guest_id?("guest_"+exp.payer_guest_id):exp.user_id;
            const payer=members.find(m=>m.id===payerId);
            const parts=expParticipants[exp.id]||[];
            return (
              <div key={exp.id} style={{...S.card,borderLeft:`4px solid ${entity.color}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={S.cardTitle}>{exp.categoria||"Sin categoría"}{exp.comercio?` · ${exp.comercio}`:""}</div>
                    <div style={{fontSize:12,color:"#888",marginTop:2}}>💳 <strong>{payer?.nombre||payer?.email||"?"}</strong></div>
                    {parts.length>0 && <div style={{fontSize:11,color:"#aaa",marginTop:2}}>👥 {parts.length} personas · {clp(Math.round((exp.monto_total||0)/Math.max(parts.length,1)))} c/u</div>}
                    <div style={{display:"flex",gap:5,margin:"4px 0"}}><Badge color="#666">{exp.categoria}</Badge></div>
                    {exp.descripcion && <div style={S.desc}>{exp.descripcion}</div>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                      <div style={S.meta}>{iso2d(exp.fecha)}</div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>{editing===exp.id?setEditing(null):startEdit(exp);}} style={{background:editing===exp.id?"#e8f0fe":"none",border:"none",color:"#1a5276",cursor:"pointer",fontSize:14,padding:"3px 6px",borderRadius:6}}>✏️</button>
                        <button onClick={()=>setDeleting(exp.id)} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:14,padding:"3px 6px"}}>🗑️</button>
                      </div>
                    </div>
                  </div>
                  <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16,color:entity.color,marginLeft:8}}>{clp(exp.monto_total)}</div>
                </div>
                {editing===exp.id && (
                  <div style={{background:"#f8f9fa",borderRadius:10,padding:"12px",marginTop:10,borderTop:"2px solid #1a5276"}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#1a5276"}}>✏️ Editar</div>
                    <div style={{marginBottom:8}}><div style={S.label}>Comercio</div><input style={S.input} value={editForm.comercio} onChange={updEdit("comercio")}/></div>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <div style={{flex:1}}><div style={S.label}>Neto</div><input style={S.input} type="number" value={editForm.monto_neto} onChange={e=>{const n=parseInt(e.target.value)||0;setEditForm(f=>({...f,monto_neto:e.target.value,iva:Math.round(n*0.19)||"",monto_total:Math.round(n*1.19)||""}));}}/></div>
                      <div style={{flex:1}}><div style={S.label}>IVA</div><input style={S.input} type="number" value={editForm.iva} onChange={updEdit("iva")}/></div>
                    </div>
                    <div style={{marginBottom:8}}><div style={S.label}>Total *</div><input style={{...S.input,fontWeight:700}} type="number" value={editForm.monto_total} onChange={updEdit("monto_total")}/></div>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <div style={{flex:1}}><div style={S.label}>Fecha</div><input style={S.input} type="date" value={editForm.fecha} onChange={updEdit("fecha")}/></div>
                      <div style={{flex:1}}><div style={S.label}>Categoría</div><select style={S.input} value={editForm.categoria} onChange={updEdit("categoria")}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                    </div>
                    <div style={{marginBottom:10}}><div style={S.label}>Nota</div><input style={S.input} value={editForm.nota} onChange={updEdit("nota")}/></div>
                    <div style={{marginBottom:10}}>
                      <div style={S.label}>¿Quiénes participan en este gasto?</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
                        {members.map(m=>{
                          const isSelected=(editForm.participants||members.map(x=>x.id)).includes(m.id);
                          return (
                            <button key={m.id} onClick={()=>{
                              const current=editForm.participants||members.map(x=>x.id);
                              const updated=isSelected?current.filter(id=>id!==m.id):[...current,m.id];
                              setEditForm(f=>({...f,participants:updated}));
                            }} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,border:`1.5px solid ${isSelected?"#1a5276":"#e0e0e0"}`,background:isSelected?"#e8f0fe":"#fff",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                              <span style={{fontSize:16}}>{isSelected?"☑️":"⬜"}</span>
                              <span style={{fontWeight:600,fontSize:13,color:isSelected?"#1a5276":"#555"}}>{m.nombre||m.email}</span>
                            </button>
                          );
                        })}
                      </div>
                      {(editForm.participants||members.map(x=>x.id)).length>0&&editForm.monto_total&&(
                        <div style={{background:"#f0f7ff",borderRadius:8,padding:"8px 12px",marginTop:6,fontSize:13,color:"#1a5276"}}>
                          Cada uno: <strong>{clp(Math.round((parseInt(String(editForm.monto_total).replace(/[^0-9]/g,""))||0)/Math.max((editForm.participants||members.map(x=>x.id)).length,1)))}</strong>
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>saveEdit(exp.id)} disabled={savingEdit} style={{flex:1,background:"#1a5276",color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{savingEdit?"Guardando...":"💾 Guardar"}</button>
                      <button onClick={()=>setEditing(null)} style={{flex:1,background:"#f0f0f0",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Cancelar</button>
                    </div>
                  </div>
                )}
                {deleting===exp.id && (
                  <div style={{background:"#fde8e8",borderRadius:8,padding:"10px",marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,color:"#b00020",flex:1}}>¿Eliminar?</span>
                    <button onClick={async()=>{await supabase.from("expenses").delete().eq("id",exp.id);setDeleting(null);window.location.reload();}} style={{background:"#b00020",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Eliminar</button>
                    <button onClick={()=>setDeleting(null)} style={{background:"#eee",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Cancelar</button>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{height:40}}/>
        </div>
      )}

      {/* SPLIT TAB */}
      {tab==="split" && (
        <div>


          {/* Invite link - simple */}
          {entity.invite_token&&(
            <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",background:"#f5f5f5",borderRadius:12,padding:"10px 14px"}}>
              <div style={{flex:1,fontSize:12,color:"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                🔗 Link de invitación
              </div>
              <button onClick={()=>{navigator.clipboard.writeText(`https://rendir-gastos-sli.vercel.app?invite=${entity.invite_token}`);alert("¡Link copiado!");}}
                style={{background:"#1a5276",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",flexShrink:0}}>
                Copiar
              </button>
              <button onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent("Únete al grupo: "+inviteUrl)}`,"_blank")}
                style={{background:"#25D366",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",flexShrink:0}}>
                WA
              </button>
            </div>
          )}

          {/* Totals */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
            {[{label:"Total",value:clp(total),color:"#1a5276"},{label:"Por persona",value:clp(perPerson),color:"#1a7a4a"},{label:"Participantes",value:String(members.length),color:"#7d3c98"}].map(item=>(
              <div key={item.label} style={{background:item.color+"10",border:`1px solid ${item.color}25`,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                <div style={{fontSize:10,color:"#aaa",marginBottom:3}}>{item.label}</div>
                <div style={{fontFamily:"'Georgia',serif",fontWeight:700,color:item.color,fontSize:14}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[["detailed","📊 Detallado"],["simple","⚡ Simplificado"]].map(([v,label])=>(
              <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"9px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,background:view===v?"#1a5276":"#f0f0f0",color:view===v?"#fff":"#555",fontFamily:"inherit"}}>{label}</button>
            ))}
          </div>

          {/* DETAILED */}
          {view==="detailed" && (
            <div>
              <div style={S.sectionLabel}>Detalle por persona</div>
              {members.map(m=>{
                const p=paid[m.id]||0,o=owes[m.id]||0,b=balance[m.id]||0;
                return (
                  <div key={m.id} style={{...S.card,borderLeft:`4px solid ${b>=0?"#1a7a4a":"#c0392b"}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontWeight:700,fontSize:15}}>{m.nombre||m.email}</div>
                      <div style={{fontSize:12,background:b>=0?"#e8f5e9":"#fde8e8",color:b>=0?"#2e7d32":"#b00020",borderRadius:6,padding:"3px 10px",fontWeight:700}}>
                        {b>0?`recibe ${clp(b)}`:b<0?`debe ${clp(Math.abs(b))}`:"al día"}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div style={{background:"#f0f7ff",borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:11,color:"#aaa",marginBottom:2}}>💳 Pagó</div>
                        <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16,color:"#1a5276"}}>{clp(p)}</div>
                      </div>
                      <div style={{background:"#f5f5f5",borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:11,color:"#aaa",marginBottom:2}}>📌 Le corresponde</div>
                        <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16,color:"#555"}}>{clp(o)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SIMPLE */}
          {view==="simple" && (
            <div>
              {tx.length===0 ? (
                <div style={{...S.card,textAlign:"center",padding:"28px"}}>
                  <div style={{fontSize:44,marginBottom:8}}>✅</div>
                  <div style={{fontWeight:700,fontSize:16}}>¡Todos al día!</div>
                  <div style={{fontSize:13,color:"#888",marginTop:4}}>No hay deudas pendientes.</div>
                </div>
              ) : (
                <div>
                  <div style={S.sectionLabel}>Transferencias a realizar</div>
                  {tx.map((t,i)=>(
                    <div key={i} style={{...S.card,borderLeft:"4px solid #c0392b",padding:"16px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:15,color:"#c0392b"}}>{t.from.nombre||t.from.email}</div>
                          <div style={{fontSize:12,color:"#aaa",margin:"4px 0"}}>↓ transfiere a</div>
                          <div style={{fontWeight:700,fontSize:15,color:"#1a7a4a"}}>{t.to.nombre||t.to.email}</div>
                        </div>
                        <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:24,color:"#1a5276"}}>{clp(t.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{...S.sectionLabel,marginTop:20}}>Balance</div>
              {members.map(m=>{
                const b=balance[m.id]||0;
                return (
                  <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f0f0f0"}}>
                    <span style={{fontWeight:600,fontSize:14}}>{m.nombre||m.email}</span>
                    <span style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:15,color:b>0?"#1a7a4a":b<0?"#c0392b":"#888"}}>
                      {b>0?`+${clp(b)}`:b<0?`-${clp(Math.abs(b))}`:"$0"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{height:40}}/>
        </div>
      )}
    </div>
  );
}


// ─── ENTITY EXPENSES SCREEN ──────────────────────────────────────────────────
function EntityExpensesScreen({entity,expenses,categories,entities,nav,onDelete,onUpdate}) {
  const [deleting,setDeleting]=useState(null);
  const [editing,setEditing]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [filterMonth,setFilterMonth]=useState("all");

  const entityExpenses=expenses.filter(e=>e.entity_id===entity?.id);
  const allMonths=[...new Set(entityExpenses.map(e=>e.fecha?.slice(0,7)).filter(Boolean))].sort().reverse();
  const filtered=filterMonth==="all"?entityExpenses:entityExpenses.filter(e=>e.fecha?.startsWith(filterMonth));
  const total=filtered.reduce((s,x)=>s+(x.monto_total||0),0);
  const totalNeto=filtered.reduce((s,x)=>s+(x.monto_neto||0),0);
  const totalIva=filtered.reduce((s,x)=>s+(x.iva||0),0);

  // Category breakdown for pie chart
  const catData=categories.map(cat=>{
    const exps=filtered.filter(e=>e.categoria===cat);
    const catTotal=exps.reduce((s,x)=>s+(x.monto_total||0),0);
    return {cat,total:catTotal,count:exps.length};
  }).filter(x=>x.count>0).sort((a,b)=>b.total-a.total);

  const PIE_COLORS=["#1a5276","#1a7a4a","#7d3c98","#b7770d","#c0392b","#2e86c1","#17a589","#d35400","#839192","#2c3e50","#e91e63","#00bcd4"];

  // Simple SVG pie chart
  const PieChart=({data,total})=>{
    if(total===0||data.length===0) return null;
    let cumAngle=0;
    const cx=100,cy=100,r=80;
    const paths=data.map((item,i)=>{
      const pct=item.total/total;
      const angle=pct*2*Math.PI;
      const x1=cx+r*Math.sin(cumAngle);
      const y1=cy-r*Math.cos(cumAngle);
      cumAngle+=angle;
      const x2=cx+r*Math.sin(cumAngle);
      const y2=cy-r*Math.cos(cumAngle);
      const large=angle>Math.PI?1:0;
      return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`} fill={PIE_COLORS[i%PIE_COLORS.length]}/>;
    });
    return (
      <svg viewBox="0 0 200 200" style={{width:"100%",maxWidth:200}}>
        {paths}
        <circle cx={cx} cy={cy} r={40} fill="#fff"/>
        <text x={cx} y={cy-8} textAnchor="middle" style={{fontSize:11,fill:"#888"}}>Total</text>
        <text x={cx} y={cy+10} textAnchor="middle" style={{fontSize:10,fill:"#1a5276",fontWeight:"bold"}}>{`$${Math.round(total/1000)}k`}</text>
      </svg>
    );
  };

  const startEdit=(exp)=>{
    setEditing(exp.id);
    setEditForm({
      comercio:exp.comercio||"",rut_comercio:exp.rut_comercio||"",
      monto_total:exp.monto_total||"",monto_neto:exp.monto_neto||"",iva:exp.iva||"",
      fecha:exp.fecha||"",tipo_documento:exp.tipo_documento||"boleta",
      numero_documento:exp.numero_documento||"",categoria:exp.categoria||"Otro",
      descripcion:exp.descripcion||"",nota:exp.nota||"",
    });
  };

  const saveEdit=async(expId)=>{
    setSaving(true);
    const {data,error}=await supabase.from("expenses").update({
      comercio:editForm.comercio,rut_comercio:editForm.rut_comercio,
      monto_total:parseInt(String(editForm.monto_total).replace(/[^0-9]/g,""))||0,
      monto_neto:parseInt(String(editForm.monto_neto).replace(/[^0-9]/g,""))||0,
      iva:parseInt(String(editForm.iva).replace(/[^0-9]/g,""))||0,
      fecha:editForm.fecha,tipo_documento:editForm.tipo_documento,
      numero_documento:editForm.numero_documento,categoria:editForm.categoria,
      descripcion:editForm.descripcion,nota:editForm.nota,
    }).eq("id",expId).select().single();
    if(!error&&data) onUpdate(data);
    setSaving(false);
    setEditing(null);
  };

  const updEdit=k=>e=>setEditForm(f=>({...f,[k]:e.target.value}));

  if(!entity) return null;

  return (
    <div style={S.page}>
      <TopBar title={entity.label} onBack={()=>nav("home")} right={
        <button onClick={()=>nav("capture")} style={{background:"#1a5276",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}}>+ Gasto</button>
      }/>

      {/* Month filter */}
      {allMonths.length>1&&(
        <div style={{marginBottom:14}}>
          <select style={S.input} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
            <option value="all">Todos los meses</option>
            {allMonths.map(m=><option key={m} value={m}>{ym2label(m)}</option>)}
          </select>
        </div>
      )}

      {/* TOTAL */}
      <div style={{background:entity.color,borderRadius:16,padding:"20px",marginBottom:16,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <EntityIcon entity={entity} size={36}/>
          <div>
            <div style={{fontSize:12,opacity:0.8}}>Total gastado</div>
            <div style={{fontFamily:"'Georgia',serif",fontSize:28,fontWeight:700}}>{clp(total)}</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={{background:"rgba(255,255,255,.15)",borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:11,opacity:0.8,marginBottom:2}}>Neto</div>
            <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16}}>{clp(totalNeto)}</div>
          </div>
          <div style={{background:"rgba(255,255,255,.15)",borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:11,opacity:0.8,marginBottom:2}}>IVA</div>
            <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16}}>{clp(totalIva)}</div>
          </div>
        </div>
      </div>

      {/* PIE CHART + TABLE */}
      {catData.length>0&&(
        <div style={{background:"#fff",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
          <div style={S.sectionLabel}>Por categoría</div>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
            <div style={{width:140,flexShrink:0}}>
              <PieChart data={catData} total={total}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              {catData.slice(0,5).map((c,i)=>(
                <div key={c.cat} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <div style={{width:10,height:10,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                  <div style={{fontSize:11,color:"#555",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.cat}</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#333",flexShrink:0}}>{Math.round(c.total/total*100)}%</div>
                </div>
              ))}
            </div>
          </div>
          {/* Full category table */}
          <div style={{borderTop:"1px solid #f0f0f0",paddingTop:10}}>
            {catData.map((c,i)=>(
              <div key={c.cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #f8f8f8"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                  <span style={{fontSize:13,color:"#333"}}>{c.cat}</span>
                  <span style={{fontSize:11,color:"#bbb"}}>({c.count})</span>
                </div>
                <span style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:14}}>{clp(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPENSE LIST */}
      <div style={S.sectionLabel}>Detalle de gastos ({filtered.length})</div>
      {filtered.length===0&&(
        <div style={S.empty}>
          <div style={{fontSize:48}}>📋</div>
          <div>Sin gastos en esta entidad</div>
          <button onClick={()=>nav("capture")} style={{...S.btn,marginTop:12,width:"auto",padding:"10px 20px"}}>+ Cargar gasto</button>
        </div>
      )}

      {[...filtered].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(exp=>{
        const catIdx=catData.findIndex(c=>c.cat===exp.categoria);
        const catColor=catIdx>=0?PIE_COLORS[catIdx%PIE_COLORS.length]:entity.color;
        return (
          <div key={exp.id} style={{...S.card,borderLeft:`4px solid ${catColor}`}}>
            <div style={{display:"flex",gap:10}}>
              {exp.image_url&&<img src={exp.image_url} alt="" style={{width:52,height:52,objectFit:"cover",borderRadius:8,flexShrink:0}}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={S.cardTitle}>{exp.categoria||"Sin categoría"}</div>
                    {exp.comercio&&<div style={{fontSize:12,color:"#888",marginTop:1}}>{exp.comercio}</div>}
                  </div>
                  <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16,color:catColor,marginLeft:8,flexShrink:0}}>{clp(exp.monto_total)}</div>
                </div>
                {exp.rut_comercio&&<div style={{fontSize:11,color:"#aaa"}}>RUT: {exp.rut_comercio}</div>}
                <div style={{display:"flex",gap:5,flexWrap:"wrap",margin:"4px 0"}}>
                  {exp.tipo_documento&&<Badge color="#999">{exp.tipo_documento}{exp.numero_documento?` N°${exp.numero_documento}`:""}</Badge>}
                  {exp.moneda&&exp.moneda!=="CLP"&&<Badge color="#7d3c98">{exp.monto_original?.toLocaleString("es-CL")} {exp.moneda}</Badge>}
                </div>
                {exp.descripcion&&<div style={S.desc}>{exp.descripcion}</div>}
                {exp.nota&&<div style={{...S.desc,color:"#bbb"}}>📝 {exp.nota}</div>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                  <div style={S.meta}>{iso2d(exp.fecha)}{exp.iva>0?` · IVA ${clp(exp.iva)}`:""}</div>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>{editing===exp.id?setEditing(null):startEdit(exp);}}
                      style={{background:editing===exp.id?"#e8f0fe":"none",border:"none",color:"#1a5276",cursor:"pointer",fontSize:14,padding:"3px 6px",borderRadius:6}}>✏️</button>
                    <button onClick={()=>setDeleting(exp.id)}
                      style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:14,padding:"3px 6px"}}>🗑️</button>
                  </div>
                </div>
              </div>
            </div>

            {/* EDIT FORM */}
            {editing===exp.id&&(
              <div style={{background:"#f8f9fa",borderRadius:10,padding:"12px",marginTop:10,borderTop:`2px solid ${entity.color}`}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:entity.color}}>✏️ Editar gasto</div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div style={{flex:2}}><div style={S.label}>Comercio</div><input style={S.input} value={editForm.comercio} onChange={updEdit("comercio")} placeholder="Comercio..."/></div>
                  <div style={{flex:1}}><div style={S.label}>Tipo doc</div><select style={S.input} value={editForm.tipo_documento} onChange={updEdit("tipo_documento")}>{["boleta","factura","ticket","recibo","otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                </div>
                <div style={{marginBottom:8}}><div style={S.label}>RUT comercio</div><input style={S.input} value={editForm.rut_comercio} onChange={updEdit("rut_comercio")} placeholder="76.123.456-7"/></div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div style={{flex:1}}><div style={S.label}>Neto</div><input style={S.input} type="number" value={editForm.monto_neto} onChange={e=>{const n=parseInt(e.target.value)||0;setEditForm(f=>({...f,monto_neto:e.target.value,iva:Math.round(n*0.19)||"",monto_total:Math.round(n*1.19)||""}));}}/></div>
                  <div style={{flex:1}}><div style={S.label}>IVA</div><input style={S.input} type="number" value={editForm.iva} onChange={updEdit("iva")}/></div>
                </div>
                <div style={{marginBottom:8}}><div style={S.label}>Total *</div><input style={{...S.input,fontWeight:700,fontSize:16}} type="number" value={editForm.monto_total} onChange={updEdit("monto_total")}/></div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div style={{flex:1}}><div style={S.label}>Fecha</div><input style={S.input} type="date" value={editForm.fecha} onChange={updEdit("fecha")}/></div>
                  <div style={{flex:1}}><div style={S.label}>Categoría</div><select style={S.input} value={editForm.categoria} onChange={updEdit("categoria")}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                </div>
                <div style={{marginBottom:8}}><div style={S.label}>Descripción</div><input style={S.input} value={editForm.descripcion} onChange={updEdit("descripcion")}/></div>
                <div style={{marginBottom:12}}><div style={S.label}>Nota</div><textarea style={{...S.input,height:56,resize:"none"}} value={editForm.nota} onChange={updEdit("nota")}/></div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>saveEdit(exp.id)} disabled={saving} style={{flex:1,background:entity.color,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit",opacity:saving?0.6:1}}>
                    {saving?"Guardando...":"💾 Guardar"}
                  </button>
                  <button onClick={()=>setEditing(null)} style={{flex:1,background:"#f0f0f0",border:"none",borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* DELETE */}
            {deleting===exp.id&&(
              <div style={{background:"#fde8e8",borderRadius:8,padding:"12px",marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,color:"#b00020",flex:1}}>¿Eliminar este gasto?</span>
                <button onClick={async()=>{await supabase.from("expenses").delete().eq("id",exp.id);onDelete(exp.id);setDeleting(null);}}
                  style={{background:"#b00020",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Eliminar</button>
                <button onClick={()=>setDeleting(null)} style={{background:"#eee",border:"none",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Cancelar</button>
              </div>
            )}
          </div>
        );
      })}
      <div style={{height:40}}/>
    </div>
  );
}


// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]           = useState(null);
  const [profile,setProfile]     = useState(null);
  const [entities,setEntities]   = useState([]);
  const [expenses,setExpenses]   = useState([]);
  const [categories,setCategories]=useState([...DEFAULT_CATEGORIES]);
  const [loading,setLoading]     = useState(true);
  const [screen,setScreen]       = useState("home");
  const [lastSeen,setLastSeen]   = useState(()=>{
    try{return JSON.parse(localStorage.getItem("lastSeen_v1")||"{}");}catch{return {};}
  });

  const markSeen=(entityId)=>{
    const now=new Date().toISOString();
    setLastSeen(prev=>{
      const updated={...prev,[entityId]:now};
      localStorage.setItem("lastSeen_v1",JSON.stringify(updated));
      return updated;
    });
  };

  const getUnseenCount=(entityId)=>{
    const uid=user?.id;
    if(!uid) return 0;
    const last=lastSeen[entityId];
    const filtered=expenses.filter(e=>e.entity_id===entityId&&e.user_id!==uid);
    if(!last) return 0; // Don't show as new until first visit
    return filtered.filter(e=>new Date(e.created_at)>new Date(last)).length;
  };

  const totalUnseen=entities.reduce((s,e)=>s+getUnseenCount(e.id),0);
  const [screenParams,setParams] = useState({});

  const nav = useCallback((s,params={})=>{setScreen(s);setParams(params||{});});

  // Check for invite token in URL on load
  const [inviteToken] = useState(()=>{ const p=new URLSearchParams(window.location.search); return p.get("invite") || new URLSearchParams(window.location.href.split("?")[1]||"").get("invite"); });

  // Auth listener
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user) initUser(session.user);
      else setLoading(false);
      // Check invite token after auth
      if(inviteToken) setScreen("invite");
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>{
      if(session?.user) initUser(session.user);
      else { setUser(null); setProfile(null); setLoading(false); }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  const initUser = async (u) => {
    setUser(u);
    // Load profile
    const {data:prof}=await supabase.from("profiles").select("*").eq("id",u.id).single();
    setProfile(prof);
    // Load entities (owned + member of)
    const {data:ownedEnts}=await supabase.from("entities").select("id,label,icon,color,type,owner_id,invite_token").eq("owner_id",u.id);
    const {data:memberEnts}=await supabase.from("entity_members").select("entity_id").eq("user_id",u.id);
    const memberEntityIds=(memberEnts||[]).map(m=>m.entity_id);
    let allEntities=[...(ownedEnts||[])];
    if(memberEntityIds.length>0){
      const {data:mEnts}=await supabase.from("entities").select("id,label,icon,color,type,owner_id,invite_token").in("id",memberEntityIds);
      allEntities=[...allEntities,...(mEnts||[]).filter(e=>!allEntities.find(x=>x.id===e.id))];
    }
    setEntities(allEntities);
    // Load custom categories
    const {data:customCats}=await supabase.from("categories").select("label").eq("user_id",u.id);
    if(customCats&&customCats.length>0){
      const customLabels=customCats.map(c=>c.label).filter(l=>!DEFAULT_CATEGORIES.includes(l));
      if(customLabels.length>0) setCategories([...DEFAULT_CATEGORIES,...customLabels]);
    }
    // Load expenses
    const entityIds=allEntities.map(e=>e.id);
    if(entityIds.length>0){
      const {data:exps}=await supabase.from("expenses").select("*").in("entity_id",entityIds).order("created_at",{ascending:false});
      setExpenses(exps||[]);
    }
    setLoading(false);
  };

  const dispatch = useCallback(action=>{
    switch(action.type){
      case "ADD_CATEGORY":
        setCategories(c=>[...c,action.payload]);
        // Save to Supabase for persistence
        supabase.auth.getUser().then(({data:{user:u}})=>{
          if(u) supabase.from("categories").insert({user_id:u.id,label:action.payload}).then(()=>{});
        });
        break;
      case "REMOVE_CATEGORY":
        setCategories(c=>c.filter(x=>x!==action.payload));
        supabase.auth.getUser().then(({data:{user:u}})=>{
          if(u) supabase.from("categories").delete().eq("user_id",u.id).eq("label",action.payload).then(()=>{});
        });
        break;
      case "ADD_ENTITY":      setEntities(e=>[...e,action.payload]); break;
      case "REMOVE_ENTITY":   setEntities(e=>e.filter(x=>x.id!==action.payload)); break;
    }
  },[]);

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); setProfile(null); setEntities([]); setExpenses([]); };

  // Guest session check
  const [guestSession,setGuestSessionState] = useState(()=>getGuestSession());
  const [guestEntity,setGuestEntity] = useState(null);
  const [showGuestSelect,setShowGuestSelect] = useState(false);

  // Check if URL has invite token and entity has guests
  useEffect(()=>{
    if(!inviteToken) return;
    supabase.from("entities").select("*").eq("invite_token",inviteToken).single().then(({data:ent})=>{
      if(!ent) return;
      // Check if entity has guest participants
      supabase.from("group_guests").select("id").eq("entity_id",ent.id).then(({data:guests})=>{
        if(guests&&guests.length>0){
          setGuestEntity(ent);
          // Check if already selected a guest
          const session=getGuestSession();
          if(!session||session.entity_id!==ent.id) setShowGuestSelect(true);
        }
      });
    });
  },[inviteToken]);

  const handleGuestSelect=(guest)=>{
    const session={guest_id:guest.id,guest_name:guest.nombre,entity_id:guest.entity_id};
    setGuestSession(session);
    setGuestSessionState(session);
    setShowGuestSelect(false);
    // Navigate to group split
    setScreen("groupSplit");
    setParams({entityId:guest.entity_id});
  };

  // Show guest select screen
  if(showGuestSelect && guestEntity) return (
    <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:480,margin:"0 auto",background:"#f7f5f0",minHeight:"100vh"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <GuestSelectScreen entity={guestEntity} onSelect={handleGuestSelect}/>
    </div>
  );

  // Show invite screen before auth if token present (for non-guest groups)
  if(inviteToken && !guestEntity && (loading || !user)) return (
    <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:480,margin:"0 auto",background:"#f7f5f0",minHeight:"100vh"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input:focus{outline:2px solid #1a5276;outline-offset:1px;}@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <InviteScreen nav={nav} token={inviteToken}/>
    </div>
  );

  if(loading) return (
    <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:480,margin:"0 auto",background:"#f7f5f0",minHeight:"100vh"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <Spinner text="Iniciando RendirGastos…"/>
    </div>
  );

  if(!user) return (
    <div style={{fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input:focus{outline:2px solid #1a5276;outline-offset:1px;}@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <AuthScreen onAuth={u=>initUser(u)}/>
    </div>
  );

  const commonProps = {profile,entities,expenses,categories,nav,userId:user?.id,dispatch};

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:480,margin:"0 auto",background:"#f7f5f0",minHeight:"100vh"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input:focus,select:focus,textarea:focus{outline:2px solid #1a5276;outline-offset:1px;}@keyframes spin{to{transform:rotate(360deg);}}button:active{opacity:.85;}`}</style>
      {screen==="home"      && <HomeScreen    {...commonProps} onSignOut={signOut} totalUnseen={totalUnseen} getUnseenCount={getUnseenCount} markSeen={markSeen} userId={user?.id}/>}
      {screen==="capture"   && <CaptureScreen {...commonProps} onSaved={exp=>{setExpenses(e=>[exp,...e]);}}/>}
      {screen==="report"    && <ReportScreen  {...commonProps} initParams={screenParams} onDelete={id=>setExpenses(e=>e.filter(x=>x.id!==id))} onUpdate={updated=>setExpenses(e=>e.map(x=>x.id===updated.id?updated:x))}/>}
      {screen==="newEntity" && <NewEntityScreen {...commonProps} onCreated={e=>setEntities(prev=>[...prev,e])}/>}
      {screen==="admin"     && <AdminScreen   {...commonProps}/>}
      {screen==="settings"  && <SettingsScreen {...commonProps}/>}
      {screen==="groupSplit"      && <GroupSplitScreen entity={entities.find(e=>e.id===screenParams?.entityId)} expenses={expenses} nav={nav}/>}
      {screen==="entityExpenses"  && <EntityExpensesScreen entity={entities.find(e=>e.id===screenParams?.entityId)} expenses={expenses} categories={categories} entities={entities} nav={nav} onDelete={id=>setExpenses(e=>e.filter(x=>x.id!==id))} onUpdate={updated=>setExpenses(e=>e.map(x=>x.id===updated.id?updated:x))}/>}
      {screen==="invite"     && <InviteScreen nav={nav} token={inviteToken}/>}
    </div>
  );
}

const S={
  page:{padding:"0 16px 16px",maxWidth:480,margin:"0 auto"},
  btn:{background:"#1a5276",color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"},
  btnOut:{background:"#fff",color:"#1a5276",border:"2px solid #1a5276",borderRadius:12,padding:"12px 16px",fontSize:14,fontWeight:700,cursor:"pointer",flex:1,fontFamily:"inherit"},
  btnIcon:{background:"#f0f0f0",border:"none",borderRadius:12,padding:"12px 14px",fontSize:18,cursor:"pointer"},
  card:{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,.05)"},
  cardTitle:{fontWeight:700,fontSize:15,color:"#111",marginBottom:4},
  desc:{fontSize:12,color:"#888",marginTop:3},
  meta:{fontSize:11,color:"#bbb",marginTop:3},
  sectionLabel:{fontSize:11,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:1,margin:"10px 0 8px"},
  empty:{textAlign:"center",color:"#bbb",padding:"40px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:10,fontSize:14},
  group:{marginBottom:14},
  row:{display:"flex",gap:10,marginBottom:14},
  label:{fontSize:11,fontWeight:700,color:"#999",marginBottom:5,textTransform:"uppercase",letterSpacing:.5},
  input:{width:"100%",border:"1.5px solid #e0e0e0",borderRadius:10,padding:"11px 13px",fontSize:14,fontFamily:"inherit",background:"#fff",color:"#111"},
  spinner:{width:40,height:40,border:"4px solid #e0eaf5",borderTop:"4px solid #1a5276",borderRadius:"50%",animation:"spin .8s linear infinite"},
};
