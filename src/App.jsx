import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://logxraqrwfqfoxtfbcxk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZ3hyYXFyd2ZxZm94dGZiY3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTQ4NTgsImV4cCI6MjA5NTk3MDg1OH0.BPFO7nxSR909KA4pykw9ofLLVzRdd-3jlSgqQt7Gztw";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PALETTE = ["#1a5276","#1a7a4a","#7d3c98","#b7770d","#c0392b","#2e86c1","#17a589","#d35400","#839192","#2c3e50"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DEFAULT_CATEGORIES = ["Bencina","Almuerzos","Gastos Oficina","Peajes","Estacionamientos","Supermercado","Restaurantes","Clientes","Merchandising","Eventos","Otro"];
const ENTITY_ICONS = ["🏢","🏗️","🏠","🚗","✈️","🎉","🤝","💼","🏪","⚽","🎨","📦"];

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
  if(logo) return React.createElement("img",{src:logo,alt:entity?.label||"",style:{width:size,height:size,objectFit:"contain",borderRadius:6,background:"transparent"}});
  return React.createElement("span",{style:{fontSize:size*0.82,lineHeight:1}},entity?.icon||"📁");
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
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:1000,
      messages:[{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:mediaType,data:base64}},
        {type:"text",text:`Analiza este comprobante/boleta chilena. Responde ÚNICAMENTE con JSON válido sin backticks:
{"comercio":"string","rut_comercio":"XX.XXX.XXX-X o null","monto_total":número o null,"monto_neto":número o null,"iva":número o null,"fecha":"YYYY-MM-DD o null","tipo_documento":"boleta|factura|ticket|recibo|otro","numero_documento":"string o null","descripcion":"máx 8 palabras","categoria_sugerida":"Bencina|Almuerzos|Gastos Oficina|Peajes|Estacionamientos|Supermercado|Restaurantes|Clientes|Merchandising|Eventos|Otro","confianza":"alta|media|baja"}`}
      ]}]
    })
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
        if(data.user) onAuth(data.user);
        else setErr("Revisá tu email para confirmar la cuenta.");
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

        {err&&<div style={{background:"#fde8e8",color:"#b00020",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13}}>{err}</div>}

        <button onClick={submit} disabled={loading} style={{...S.btn,opacity:loading?0.6:1}}>
          {loading?"Cargando…":mode==="login"?"Entrar":"Crear cuenta"}
        </button>

        <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>
          {mode==="login"
            ? <span>¿No tenés cuenta? <button onClick={()=>setMode("register")} style={{background:"none",border:"none",color:"#1a5276",cursor:"pointer",fontWeight:700,fontSize:13}}>Registrarse</button></span>
            : <span>¿Ya tenés cuenta? <button onClick={()=>setMode("login")} style={{background:"none",border:"none",color:"#1a5276",cursor:"pointer",fontWeight:700,fontSize:13}}>Entrar</button></span>
          }
        </div>
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({profile,entities,expenses,nav,onSignOut}) {
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
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:2}}>Total mes</div>
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
            <div key={e.id} onClick={()=>nav("report",{entityId:e.id})}
              style={{background:e.color+"12",border:`1.5px solid ${e.color}33`,borderRadius:14,padding:"14px 12px",cursor:"pointer"}}>
              <div style={{marginBottom:6,display:"flex",alignItems:"center",justifyContent:"flex-start"}}><EntityIcon entity={e} size={32}/></div>
              <div style={{fontSize:11,fontWeight:700,color:e.color,lineHeight:1.2,marginBottom:4}}>
                {e.label} {typeTag&&<span style={{fontSize:10}}>{typeTag}</span>}
              </div>
              <div style={{fontFamily:"'Georgia',serif",fontSize:17,fontWeight:700,color:e.color}}>{clp(tot)}</div>
              <div style={{fontSize:11,color:"#aaa",marginTop:2}}>{cnt} gasto{cnt!==1?"s":""}</div>
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
                <div style={S.cardTitle}>{exp.comercio||"Sin nombre"}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>
                  {ent&&<Badge color={ent.color}>{ent.icon} {ent.label}</Badge>}
                  <Badge color="#666">{exp.categoria}</Badge>
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
    const {data,error} = await supabase.from("entities").insert({
      label:form.label, icon:form.icon, color:form.color,
      type: profile?.role==="admin" ? form.type : form.type==="global"?"personal":form.type,
      owner_id: userData.user.id,
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
  const fileRef=useRef();
  const blank={entity_id:"",comercio:"",rut_comercio:"",monto_total:"",monto_neto:"",iva:"",fecha:todayFn(),tipo_documento:"boleta",numero_documento:"",categoria:"Otro",descripcion:"",nota:""};
  const [form,setForm]=useState(blank);
  const upd=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const handleFile=file=>{
    if(!file)return; setMimeType(file.type||"image/jpeg");
    const r=new FileReader();
    r.onload=ev=>{setImgData({base64:ev.target.result.split(",")[1],url:ev.target.result});setStep("preview");};
    r.readAsDataURL(file);
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
    const {data,error}=await supabase.from("expenses").insert({
      entity_id:form.entity_id, user_id:userId,
      comercio:form.comercio, rut_comercio:form.rut_comercio,
      monto_total:parseInt(String(form.monto_total).replace(/\D/g,""))||0,
      monto_neto:parseInt(String(form.monto_neto).replace(/\D/g,""))||0,
      iva:parseInt(String(form.iva).replace(/\D/g,""))||0,
      fecha:form.fecha, tipo_documento:form.tipo_documento,
      numero_documento:form.numero_documento, categoria:form.categoria,
      descripcion:form.descripcion, nota:form.nota, image_url,
    }).select().single();
    if(error){setErr(error.message);setSaving(false);return;}
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
            <button key={e.id} onClick={()=>setForm(f=>({...f,entity_id:e.id}))}
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
      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Neto</div><input style={S.input} type="number" value={form.monto_neto} onChange={upd("monto_neto")} placeholder="0"/></div>
        <div style={{flex:1}}><div style={S.label}>IVA</div><input style={S.input} type="number" value={form.iva} onChange={upd("iva")} placeholder="0"/></div>
      </div>
      <div style={S.group}><div style={S.label}>Monto total *</div><input style={{...S.input,fontSize:18,fontWeight:700}} type="number" value={form.monto_total} onChange={upd("monto_total")} placeholder="0"/></div>
      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Fecha</div><input style={S.input} type="date" value={form.fecha} onChange={upd("fecha")}/></div>
        <div style={{flex:1}}><div style={S.label}>Categoría</div><select style={S.input} value={form.categoria} onChange={upd("categoria")}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div style={S.group}><div style={S.label}>Descripción</div><input style={S.input} value={form.descripcion} onChange={upd("descripcion")} placeholder="Breve descripción..."/></div>
      <div style={S.group}><div style={S.label}>Nota</div><textarea style={{...S.input,height:64,resize:"none"}} value={form.nota} onChange={upd("nota")} placeholder="Comentario adicional..."/></div>
      <button style={S.btn} onClick={save} disabled={saving}>{saving?"Guardando…":"💾 Guardar Gasto"}</button>
      <div style={{height:40}}/>
    </div>
  );
}

// ─── REPORT ───────────────────────────────────────────────────────────────────
function ReportScreen({entities,expenses,categories,nav,initParams,onDelete}) {
  const [filterEntity,setFilterEntity]=useState(initParams?.entityId||"all");
  const [filterMonth,setFilterMonth]=useState("all");
  const [deleting,setDeleting]=useState(null);
  const [exporting,setExporting]=useState(null);

  const allMonths=[...new Set(expenses.map(e=>e.fecha?.slice(0,7)).filter(Boolean))].sort().reverse();
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
                  <div style={S.cardTitle}>{exp.comercio||"Sin nombre"}</div>
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
                  <button onClick={()=>setDeleting(exp.id)} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:14}}>🗑️</button>
                </div>
              </div>
            </div>
            {deleting===exp.id&&(
              <div style={{background:"#fde8e8",borderRadius:8,padding:"10px",marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,color:"#b00020",flex:1}}>¿Eliminar?</span>
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
      await supabase.from("entity_members").delete().eq("user_id",userId).eq("entity_id",entityId);
      setMemberships(m=>({...m,[userId]:(m[userId]||[]).filter(id=>id!==entityId)}));
    } else {
      await supabase.from("entity_members").insert({user_id:userId,entity_id:entityId});
      setMemberships(m=>({...m,[userId]:[...(m[userId]||[]),entityId]}));
    }
  };

  const globalEntities=entities.filter(e=>e.type==="global");

  if(loading) return <Spinner text="Cargando usuarios…"/>;

  return (
    <div style={S.page}>
      <TopBar title="Gestión de Usuarios" onBack={()=>nav("home")}/>
      <div style={{background:"#f0f7ff",border:"1px solid #bee3f8",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1a5276"}}>
        Asignás qué entidades globales puede ver cada usuario.
      </div>

      {users.map(user=>(
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

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]           = useState(null);
  const [profile,setProfile]     = useState(null);
  const [entities,setEntities]   = useState([]);
  const [expenses,setExpenses]   = useState([]);
  const [categories,setCategories]=useState([...DEFAULT_CATEGORIES]);
  const [loading,setLoading]     = useState(true);
  const [screen,setScreen]       = useState("home");
  const [screenParams,setParams] = useState({});

  const nav = useCallback((s,params={})=>{setScreen(s);setParams(params||{});});

  // Auth listener
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user) initUser(session.user);
      else setLoading(false);
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
    const {data:ownedEnts}=await supabase.from("entities").select("*").eq("owner_id",u.id);
    const {data:memberEnts}=await supabase.from("entity_members").select("entity_id").eq("user_id",u.id);
    const memberEntityIds=(memberEnts||[]).map(m=>m.entity_id);
    let allEntities=[...(ownedEnts||[])];
    if(memberEntityIds.length>0){
      const {data:mEnts}=await supabase.from("entities").select("*").in("id",memberEntityIds);
      allEntities=[...allEntities,...(mEnts||[]).filter(e=>!allEntities.find(x=>x.id===e.id))];
    }
    setEntities(allEntities);
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
      case "ADD_CATEGORY":    setCategories(c=>[...c,action.payload]); break;
      case "REMOVE_CATEGORY": setCategories(c=>c.filter(x=>x!==action.payload)); break;
      case "ADD_ENTITY":      setEntities(e=>[...e,action.payload]); break;
      case "REMOVE_ENTITY":   setEntities(e=>e.filter(x=>x.id!==action.payload)); break;
    }
  },[]);

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); setProfile(null); setEntities([]); setExpenses([]); };

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
      {screen==="home"      && <HomeScreen    {...commonProps} onSignOut={signOut}/>}
      {screen==="capture"   && <CaptureScreen {...commonProps} onSaved={exp=>{setExpenses(e=>[exp,...e]);}}/>}
      {screen==="report"    && <ReportScreen  {...commonProps} initParams={screenParams} onDelete={id=>setExpenses(e=>e.filter(x=>x.id!==id))}/>}
      {screen==="newEntity" && <NewEntityScreen {...commonProps} onCreated={e=>setEntities(prev=>[...prev,e])}/>}
      {screen==="admin"     && <AdminScreen   {...commonProps}/>}
      {screen==="settings"  && <SettingsScreen {...commonProps}/>}
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
