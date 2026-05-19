import { useState, useReducer, useCallback, useRef } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "rendicion_v5";
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const PALETTE = ["#1a5276","#1a7a4a","#7d3c98","#b7770d","#c0392b","#2e86c1","#17a589","#d35400","#839192","#2c3e50"];

const DEFAULT_STATE = {
  expenses: [],
  entities: [
    { id:"porteria",   label:"Portería",                 icon:"🏢", color:"#1a5276" },
    { id:"bl_activos", label:"BL Activos Inmobiliarios", icon:"🏗️", color:"#1a7a4a" },
  ],
  categories: ["Bencina","Almuerzos","Gastos Oficina","Peajes","Estacionamientos","Supermercado","Restaurantes","Clientes","Merchandising","Eventos","Otro"],
  closedMonths: [],
  settings: { contactorEmail: "", nombreEmpresa: "Mis Empresas" },
};

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function persist(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }
function load() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }

// ─── REDUCER ─────────────────────────────────────────────────────────────────
function appReducer(state, action) {
  let next;
  switch (action.type) {
    case "ADD_EXPENSE":     next = { ...state, expenses: [...state.expenses, action.payload] }; break;
    case "DELETE_EXPENSE":  next = { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) }; break;
    case "ADD_ENTITY":      next = { ...state, entities: [...state.entities, action.payload] }; break;
    case "REMOVE_ENTITY":   next = { ...state, entities: state.entities.filter(e => e.id !== action.payload) }; break;
    case "ADD_CATEGORY":    if (state.categories.includes(action.payload)) return state;
                            next = { ...state, categories: [...state.categories, action.payload] }; break;
    case "REMOVE_CATEGORY": next = { ...state, categories: state.categories.filter(c => c !== action.payload) }; break;
    case "UPDATE_SETTINGS": next = { ...state, settings: { ...state.settings, ...action.payload } }; break;
    case "CLOSE_MONTH":
      next = {
        ...state,
        expenses: state.expenses.map(e =>
          e.fecha?.startsWith(action.payload) ? { ...e, imageUrl: null } : e
        ),
        closedMonths: [...(state.closedMonths || []), action.payload],
      }; break;
    default: return state;
  }
  persist(next); return next;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const clp     = n  => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const iso2d   = s  => { if (!s) return ""; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const todayFn = () => new Date().toISOString().split("T")[0];
const ym2label = ym => { if (!ym) return ""; const [y,m] = ym.split("-"); return `${MONTH_NAMES[parseInt(m)-1]} ${y}`; };
const hexRgb  = h  => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];

async function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── AI ANALYSIS ─────────────────────────────────────────────────────────────
async function analyzeReceipt(base64, mediaType) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: `Analiza este comprobante/boleta chilena. Responde ÚNICAMENTE con JSON válido sin backticks:
{"comercio":"string","rut_comercio":"XX.XXX.XXX-X o null","monto_total":número o null,"monto_neto":número o null,"iva":número o null,"fecha":"YYYY-MM-DD o null","tipo_documento":"boleta|factura|ticket|recibo|otro","numero_documento":"string o null","descripcion":"máx 8 palabras","categoria_sugerida":"Bencina|Almuerzos|Gastos Oficina|Peajes|Estacionamientos|Supermercado|Restaurantes|Clientes|Merchandising|Eventos|Otro","confianza":"alta|media|baja"}` }
      ]}]
    })
  });
  const data = await res.json();
  const text = (data.content || []).map(c => c.text || "").join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── EXCEL EXPORT ────────────────────────────────────────────────────────────
async function buildExcel(yearMonth, monthExpenses, entities) {
  const XLSX = window.XLSX;
  const label = ym2label(yearMonth);
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    [`RENDICIÓN MENSUAL — ${label}`], [],
    ["Entidad","N° Gastos","Neto","IVA","Total"],
  ];
  let gTotal = 0, gNeto = 0, gIva = 0, gCount = 0;
  for (const ent of entities) {
    const exps = monthExpenses.filter(e => e.entity === ent.id);
    const tot  = exps.reduce((s,x) => s+(x.monto_total||0), 0);
    const neto = exps.reduce((s,x) => s+(x.monto_neto||0),  0);
    const iva  = exps.reduce((s,x) => s+(x.iva||0),         0);
    summaryRows.push([ent.label, exps.length, neto, iva, tot]);
    gTotal += tot; gNeto += neto; gIva += iva; gCount += exps.length;
  }
  summaryRows.push([], ["TOTAL", gCount, gNeto, gIva, gTotal]);
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{wch:32},{wch:12},{wch:14},{wch:12},{wch:14}];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

  // One sheet per entity
  for (const ent of entities) {
    const exps = monthExpenses.filter(e => e.entity === ent.id);
    if (!exps.length) continue;
    const rows = [
      [`${ent.label} — ${label}`], [],
      ["#","Fecha","Comercio","RUT Comercio","Tipo Doc","N° Doc","Categoría","Descripción","Neto","IVA","Total","Nota"],
    ];
    exps.forEach((exp,i) => {
      rows.push([i+1, iso2d(exp.fecha), exp.comercio||"", exp.rut_comercio||"",
        exp.tipo_documento||"", exp.numero_documento||"", exp.categoria||"",
        exp.descripcion||"", exp.monto_neto||0, exp.iva||0, exp.monto_total||0, exp.nota||""]);
    });
    const ds=4, de=ds+exps.length-1;
    rows.push([], ["","","","","","","","TOTALES",
      `=SUM(I${ds}:I${de})`,`=SUM(J${ds}:J${de})`,`=SUM(K${ds}:K${de})`,""]
    );
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{wch:4},{wch:10},{wch:26},{wch:14},{wch:10},{wch:10},{wch:16},{wch:24},{wch:12},{wch:10},{wch:12},{wch:24}];
    XLSX.utils.book_append_sheet(wb, ws, ent.label.slice(0,31).replace(/[\\/*?[\]]/g,""));
  }

  // return as base64 for email attachment
  const wbout = XLSX.write(wb, { bookType:"xlsx", type:"base64" });
  XLSX.writeFile(wb, `Rendicion_${yearMonth}.xlsx`);
  return wbout; // base64
}

// ─── PDF EXPORT (per entity) ──────────────────────────────────────────────────
async function buildEntityPDF(exps, ent, label) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W = 210;
  const total     = exps.reduce((s,x) => s+(x.monto_total||0), 0);
  const totalNeto = exps.reduce((s,x) => s+(x.monto_neto||0),  0);
  const totalIva  = exps.reduce((s,x) => s+(x.iva||0),         0);
  const ec = hexRgb(ent.color);

  const drawHeader = (p, tp) => {
    doc.setFillColor(...ec); doc.rect(0,0,W,22,"F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(13); doc.setFont("helvetica","bold");
    doc.text(`${ent.label}`, 14, 10);
    doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text(`Rendición Mensual — ${label}`, 14, 16);
    doc.text(`Página ${p} de ${tp}`, W-14, 16, { align:"right" });
    doc.setTextColor(0,0,0);
  };

  drawHeader(1,1);

  // Summary boxes
  const sy=28, bw=(W-28-9)/4;
  [
    { label:"Total",        value:clp(total),         rgb:ec },
    { label:"Neto",         value:clp(totalNeto),      rgb:[26,122,74] },
    { label:"IVA",          value:clp(totalIva),       rgb:[125,60,152] },
    { label:"Comprobantes", value:String(exps.length), rgb:[183,119,13] },
  ].forEach(({label:bl,value,rgb},i) => {
    const x = 14+i*(bw+3);
    doc.setFillColor(...rgb); doc.roundedRect(x,sy,bw,18,2,2,"F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.text(bl,x+bw/2,sy+6,{align:"center"});
    doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.text(value,x+bw/2,sy+13,{align:"center"});
  });
  doc.setTextColor(0,0,0);

  // Category breakdown
  let y = sy+26;
  const cats = [...new Set(exps.map(e=>e.categoria))];
  const catData = cats.map(cat => {
    const ce = exps.filter(e=>e.categoria===cat);
    return [cat, String(ce.length), clp(ce.reduce((s,x)=>s+(x.monto_total||0),0))];
  }).sort((a,b) => parseInt(b[2].replace(/\D/g,"")) - parseInt(a[2].replace(/\D/g,"")));

  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(80,80,80);
  doc.text("RESUMEN POR CATEGORÍA", 14, y); doc.setTextColor(0,0,0);
  doc.autoTable({
    startY:y+3, head:[["Categoría","N° Gastos","Total"]],
    body:[...catData, ["TOTAL",String(exps.length),clp(total)]],
    theme:"grid",
    headStyles:{ fillColor:ec, textColor:255, fontStyle:"bold", fontSize:8 },
    bodyStyles:{ fontSize:8 },
    columnStyles:{ 0:{cellWidth:80}, 1:{cellWidth:25,halign:"center"}, 2:{cellWidth:35,halign:"right"} },
    margin:{left:14,right:14},
    didParseCell: d => { if(d.row.index===catData.length){d.cell.styles.fontStyle="bold";d.cell.styles.fillColor=[245,245,245];} }
  });

  // Detail table
  y = doc.lastAutoTable.finalY+8;
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(80,80,80);
  doc.text("DETALLE DE COMPROBANTES", 14, y); doc.setTextColor(0,0,0);
  const expRows = exps.map((exp,i) => [
    String(i+1), iso2d(exp.fecha), exp.comercio||"Sin nombre", exp.rut_comercio||"-",
    (exp.tipo_documento||"")+(exp.numero_documento?` N°${exp.numero_documento}`:""),
    exp.categoria||"", clp(exp.monto_neto), clp(exp.iva), clp(exp.monto_total),
  ]);
  doc.autoTable({
    startY:y+3,
    head:[["#","Fecha","Comercio","RUT","Documento","Categoría","Neto","IVA","Total"]],
    body:[...expRows, ["","","","","","TOTAL",clp(totalNeto),clp(totalIva),clp(total)]],
    theme:"striped",
    headStyles:{ fillColor:ec, textColor:255, fontStyle:"bold", fontSize:7 },
    bodyStyles:{ fontSize:7 },
    columnStyles:{
      0:{cellWidth:7,halign:"center"}, 1:{cellWidth:17}, 2:{cellWidth:35},
      3:{cellWidth:22}, 4:{cellWidth:22}, 5:{cellWidth:20},
      6:{cellWidth:18,halign:"right"}, 7:{cellWidth:13,halign:"right"}, 8:{cellWidth:18,halign:"right"},
    },
    margin:{left:14,right:14},
    didParseCell: d => { if(d.row.index===expRows.length){d.cell.styles.fontStyle="bold";d.cell.styles.fillColor=[245,245,245];} }
  });

  // Images page
  const withImg = exps.filter(e=>e.imageUrl);
  if (withImg.length > 0) {
    doc.addPage();
    doc.setFillColor(...ec); doc.rect(0,0,W,14,"F");
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont("helvetica","bold");
    doc.text("IMÁGENES DE COMPROBANTES", 14, 10); doc.setTextColor(0,0,0);

    let iy=20, col=0;
    const imgW=85, imgH=64;
    for (const exp of withImg) {
      if (iy+imgH+12 > 285) { doc.addPage(); iy=14; }
      const ix = col===0 ? 14 : 14+imgW+8;
      doc.setFillColor(245,245,245); doc.rect(ix,iy,imgW,9,"F");
      doc.setFontSize(6.5); doc.setFont("helvetica","bold"); doc.setTextColor(40,40,40);
      doc.text(exp.comercio||"Sin nombre", ix+2, iy+4, {maxWidth:imgW-4});
      doc.setFont("helvetica","normal");
      doc.text(`${iso2d(exp.fecha)}  ·  ${clp(exp.monto_total)}  ·  ${exp.categoria||""}`, ix+2, iy+8, {maxWidth:imgW-4});
      doc.setTextColor(0,0,0);
      try { doc.addImage(exp.imageUrl,"JPEG",ix,iy+9,imgW,imgH-9,undefined,"MEDIUM"); }
      catch {
        doc.setDrawColor(220,220,220); doc.rect(ix,iy+9,imgW,imgH-9);
        doc.setFontSize(7); doc.text("Imagen no disponible",ix+imgW/2,iy+9+(imgH-9)/2,{align:"center"});
      }
      col++; if(col===2){iy+=imgH+6;col=0;}
    }
  }

  // Fix headers
  const tp = doc.getNumberOfPages();
  for (let p=1;p<=tp;p++) { doc.setPage(p); drawHeader(p,tp); }

  // Save + return base64
  const filename = `Rendicion_${ent.label.replace(/\s+/g,"_")}_${label.replace(/\s+/g,"_")}.pdf`;
  doc.save(filename);
  return { base64: doc.output("datauristring").split(",")[1], filename };
}

// ─── MONTHLY CLOSE ORCHESTRATOR ───────────────────────────────────────────────
async function runMonthlyClose(yearMonth, allExpenses, entities, onProgress) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");

  const monthExpenses = allExpenses.filter(e => e.fecha?.startsWith(yearMonth));
  const label = ym2label(yearMonth);
  const attachments = [];

  // Excel
  onProgress("📊 Generando Excel…");
  const excelB64 = await buildExcel(yearMonth, monthExpenses, entities);
  attachments.push({ base64: excelB64, filename: `Rendicion_${yearMonth}.xlsx`, type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  // PDF per entity
  for (const ent of entities) {
    const exps = monthExpenses.filter(e => e.entity === ent.id);
    if (!exps.length) continue;
    onProgress(`📄 Generando PDF — ${ent.label}…`);
    const { base64, filename } = await buildEntityPDF(exps, ent, label);
    attachments.push({ base64, filename, type:"application/pdf" });
    await new Promise(r => setTimeout(r, 500));
  }

  return { attachments, monthExpenses, label };
}

// ─── GMAIL MAILTO HELPER ──────────────────────────────────────────────────────
function openGmailCompose(toEmail, subject, body) {
  // Opens Gmail compose with pre-filled fields (attachments must be added manually)
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(gmailUrl, "_blank");
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

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({state,nav}) {
  const {expenses,entities,closedMonths=[]} = state;
  const grandTotal = expenses.reduce((s,x)=>s+(x.monto_total||0),0);
  const now = new Date();

  // Detect if previous month is unclosed
  const prevDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,"0")}`;
  const prevHasExpenses = expenses.some(e=>e.fecha?.startsWith(prevYM));
  const prevIsClosed = (closedMonths||[]).includes(prevYM);
  const showCloseAlert = prevHasExpenses && !prevIsClosed;

  return (
    <div style={S.page}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"24px 0 16px",borderBottom:"1px solid #e8e4df"}}>
        <div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:26,fontWeight:700,color:"#111"}}>RendirGastos</div>
          <div style={{fontSize:13,color:"#999",marginTop:3}}>{MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:2}}>Total mes</div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:22,fontWeight:700,color:"#1a5276"}}>{clp(grandTotal)}</div>
        </div>
      </div>

      {/* Alert: previous month not closed */}
      {showCloseAlert && (
        <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:12,padding:"12px 14px",margin:"14px 0 4px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>📅</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14,color:"#7a5500"}}>Tenés gastos sin cerrar en {ym2label(prevYM)}</div>
            <div style={{fontSize:12,color:"#b7770d",marginTop:2}}>Hacé el cierre mensual para enviar el reporte al contador.</div>
          </div>
          <button onClick={()=>nav("close",{yearMonth:prevYM})}
            style={{background:"#b7770d",color:"#fff",border:"none",borderRadius:9,padding:"8px 12px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",whiteSpace:"nowrap"}}>
            Cerrar mes
          </button>
        </div>
      )}

      {/* Entity cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"18px 0"}}>
        {entities.map(e=>{
          const tot=expenses.filter(x=>x.entity===e.id).reduce((s,x)=>s+(x.monto_total||0),0);
          const cnt=expenses.filter(x=>x.entity===e.id).length;
          return (
            <div key={e.id} onClick={()=>nav("report",{entity:e.id})}
              style={{background:e.color+"12",border:`1.5px solid ${e.color}33`,borderRadius:14,padding:"14px 12px",cursor:"pointer"}}>
              <div style={{fontSize:28,marginBottom:6}}>{e.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:e.color,lineHeight:1.2,marginBottom:4}}>{e.label}</div>
              <div style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:700,color:e.color}}>{clp(tot)}</div>
              <div style={{fontSize:11,color:"#aaa",marginTop:2}}>{cnt} gasto{cnt!==1?"s":""}</div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <button style={S.btn} onClick={()=>nav("capture")}>+ Nuevo gasto</button>
        <button style={S.btnOut} onClick={()=>nav("report",{})}>📊 Reporte</button>
        <button style={S.btnIcon} onClick={()=>nav("settings")}>⚙️</button>
      </div>
      <button onClick={()=>nav("close",{})}
        style={{width:"100%",background:"#fff",border:"2px solid #b7770d",color:"#b7770d",borderRadius:12,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:18,fontFamily:"inherit"}}>
        📅 Cierre Mensual
      </button>

      {/* Recent */}
      <div style={S.sectionLabel}>Últimos gastos</div>
      {expenses.length===0&&<div style={S.empty}><div style={{fontSize:48}}>📷</div><div>Fotografía tu primer comprobante</div></div>}
      {[...expenses].reverse().slice(0,12).map(exp=>{
        const ent=entities.find(e=>e.id===exp.entity);
        return (
          <div key={exp.id} style={{...S.card,borderLeft:`4px solid ${ent?.color||"#ccc"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={S.cardTitle}>{exp.comercio||"Sin nombre"}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>
                  {ent&&<Badge color={ent.color}>{ent.icon} {ent.label}</Badge>}
                  <Badge color="#666">{exp.categoria}</Badge>
                  {exp.tipo_documento&&<Badge color="#999">{exp.tipo_documento}</Badge>}
                </div>
                {exp.descripcion&&<div style={S.desc}>{exp.descripcion}</div>}
                <div style={S.meta}>{iso2d(exp.fecha)}{exp.rut_comercio?` · RUT ${exp.rut_comercio}`:""}</div>
              </div>
              <div style={{textAlign:"right",marginLeft:12,flexShrink:0}}>
                <div style={{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:16,color:ent?.color||"#333"}}>{clp(exp.monto_total)}</div>
                {exp.iva>0&&<div style={{fontSize:10,color:"#bbb"}}>IVA {clp(exp.iva)}</div>}
              </div>
            </div>
          </div>
        );
      })}
      <div style={{height:32}}/>
    </div>
  );
}

// ─── MONTHLY CLOSE SCREEN ─────────────────────────────────────────────────────
function CloseScreen({state,dispatch,nav,initParams}) {
  const {expenses,entities,closedMonths=[],settings={}} = state;

  // Build list of closeable months
  const allYMs = [...new Set(expenses.map(e=>e.fecha?.slice(0,7)).filter(Boolean))].sort().reverse();
  const openYMs = allYMs.filter(ym=>!closedMonths.includes(ym));

  const [selectedYM, setSelectedYM] = useState(initParams?.yearMonth || openYMs[0] || "");
  const [step, setStep] = useState("preview"); // preview | running | done
  const [progress, setProgress] = useState("");
  const [doneData, setDoneData] = useState(null);
  const [emailTo, setEmailTo] = useState(settings.contadorEmail||"");

  const monthExps = expenses.filter(e=>e.fecha?.startsWith(selectedYM));
  const total = monthExps.reduce((s,x)=>s+(x.monto_total||0),0);
  const withImg = monthExps.filter(e=>e.imageUrl).length;

  const run = async () => {
    if (!selectedYM) return;
    setStep("running"); setProgress("Preparando cierre…");
    try {
      const result = await runMonthlyClose(selectedYM, expenses, entities, setProgress);
      dispatch({ type:"CLOSE_MONTH", payload:selectedYM });
      setDoneData(result);
      setStep("done");
    } catch(e) {
      setProgress("Error: "+e.message);
    }
  };

  const openGmail = () => {
    if (!emailTo) return;
    const label = ym2label(selectedYM);
    const subject = `Rendición de Gastos — ${label}`;
    const body = `Hola,\n\nAdjunto la rendición de gastos correspondiente a ${label}.\n\nSe incluye:\n• Excel con detalle por entidad\n• PDF por entidad con imágenes de comprobantes\n\nTotal del período: ${clp(total)}\n\nQuedo a disposición para cualquier consulta.\n\nSaludos`;
    openGmailCompose(emailTo, subject, body);
  };

  if (step==="running") return (
    <div style={{...S.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",gap:20}}>
      <div style={S.spinner}/>
      <div style={{fontFamily:"'Georgia',serif",fontSize:19,color:"#1a5276",textAlign:"center"}}>Procesando cierre mensual</div>
      <div style={{fontSize:14,color:"#888",textAlign:"center",maxWidth:280}}>{progress}</div>
      <div style={{fontSize:12,color:"#bbb"}}>Los archivos se están descargando…</div>
    </div>
  );

  if (step==="done") return (
    <div style={S.page}>
      <TopBar title="Cierre completado" onBack={()=>nav("home")}/>
      <div style={{textAlign:"center",padding:"20px 0"}}>
        <div style={{fontSize:64}}>✅</div>
        <div style={{fontFamily:"'Georgia',serif",fontSize:20,fontWeight:700,margin:"12px 0 6px"}}>
          {ym2label(selectedYM)} cerrado
        </div>
        <div style={{fontSize:14,color:"#888"}}>Los archivos se descargaron a tu dispositivo</div>
      </div>

      <div style={{background:"#f0f7f0",border:"1px solid #a8d5bc",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1a7a4a",marginBottom:8}}>📦 Archivos generados</div>
        <div style={{fontSize:13,color:"#555"}}>• <strong>Excel:</strong> Rendicion_{selectedYM}.xlsx (todas las entidades)</div>
        {entities.map(ent=>{
          const hasExp = monthExps.filter(e=>e.entity===ent.id).length>0;
          return hasExp ? <div key={ent.id} style={{fontSize:13,color:"#555",marginTop:4}}>• <strong>PDF {ent.label}:</strong> con comprobantes e imágenes</div> : null;
        })}
        <div style={{fontSize:12,color:"#aaa",marginTop:8}}>Las imágenes fueron borradas de la app para liberar espacio.</div>
      </div>

      {/* Gmail button */}
      <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:"#333",marginBottom:10}}>📧 Enviar al contador por Gmail</div>
        <div style={S.group}>
          <div style={S.label}>Email del contador</div>
          <input style={S.input} type="email" value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="contador@ejemplo.com"/>
        </div>
        <div style={{fontSize:12,color:"#aaa",marginBottom:10}}>Se abre Gmail con el asunto y texto pre-llenado. Adjuntá los archivos descargados antes de enviar.</div>
        <button onClick={openGmail} disabled={!emailTo}
          style={{width:"100%",background:emailTo?"#1a73e8":"#ccc",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontWeight:700,fontSize:14,cursor:emailTo?"pointer":"default",fontFamily:"inherit"}}>
          Abrir Gmail para enviar
        </button>
      </div>

      <button onClick={()=>nav("home")} style={S.btn}>Volver al inicio</button>
      <div style={{height:32}}/>
    </div>
  );

  // Preview
  return (
    <div style={S.page}>
      <TopBar title="Cierre Mensual" onBack={()=>nav("home")}/>

      {openYMs.length===0 ? (
        <div style={S.empty}>
          <div style={{fontSize:48}}>📭</div>
          <div>No hay meses abiertos con gastos para cerrar</div>
          <button onClick={()=>nav("home")} style={{...S.btn,marginTop:16}}>Volver</button>
        </div>
      ) : (
        <>
          <div style={{background:"#f0f7ff",border:"1px solid #bee3f8",borderRadius:12,padding:"12px 14px",marginBottom:16,fontSize:13,color:"#1a5276"}}>
            El cierre genera un Excel + un PDF por entidad, los descarga, y borra las imágenes para liberar espacio.
          </div>

          <div style={S.group}>
            <div style={S.label}>¿Qué mes querés cerrar?</div>
            <select style={S.input} value={selectedYM} onChange={e=>setSelectedYM(e.target.value)}>
              {openYMs.map(ym=><option key={ym} value={ym}>{ym2label(ym)}</option>)}
            </select>
          </div>

          {selectedYM && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
              {[
                {label:"Gastos",value:String(monthExps.length),color:"#1a5276"},
                {label:"Total",value:clp(total),color:"#1a7a4a"},
                {label:"Con foto",value:String(withImg),color:"#7d3c98"},
              ].map(item=>(
                <div key={item.label} style={{background:item.color+"10",border:`1px solid ${item.color}25`,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:3}}>{item.label}</div>
                  <div style={{fontFamily:"'Georgia',serif",fontWeight:700,color:item.color,fontSize:15}}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Per-entity breakdown */}
          {selectedYM && entities.map(ent=>{
            const exps=monthExps.filter(e=>e.entity===ent.id);
            if(!exps.length) return null;
            return (
              <div key={ent.id} style={{...S.card,borderLeft:`4px solid ${ent.color}`,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:20}}>{ent.icon}</span>
                    <span style={{fontWeight:700,color:ent.color,fontSize:14}}>{ent.label}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"'Georgia',serif",fontWeight:700,color:ent.color}}>{clp(exps.reduce((s,x)=>s+(x.monto_total||0),0))}</div>
                    <div style={{fontSize:11,color:"#aaa"}}>{exps.length} gastos · {exps.filter(e=>e.imageUrl).length} fotos</div>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:10,padding:"10px 14px",marginTop:8,marginBottom:16,fontSize:13,color:"#7a5500"}}>
            ⚠️ Las imágenes de los comprobantes se borrarán de la app. Los datos de texto quedan guardados.
          </div>

          <button onClick={run} style={S.btn}>
            🔒 Generar archivos y cerrar {selectedYM ? ym2label(selectedYM) : ""}
          </button>

          {/* Closed months history */}
          {closedMonths.length>0&&(
            <>
              <div style={{...S.sectionLabel,marginTop:24}}>Meses cerrados</div>
              {[...closedMonths].reverse().map(ym=>(
                <div key={ym} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f0f0f0"}}>
                  <span style={{fontSize:14,fontWeight:600}}>{ym2label(ym)}</span>
                  <span style={{fontSize:12,background:"#e8f5e9",color:"#2e7d32",borderRadius:6,padding:"3px 10px",fontWeight:700}}>✓ Cerrado</span>
                </div>
              ))}
            </>
          )}
          <div style={{height:40}}/>
        </>
      )}
    </div>
  );
}

// ─── CAPTURE ──────────────────────────────────────────────────────────────────
function CaptureScreen({state,dispatch,nav}) {
  const {entities,categories}=state;
  const [step,setStep]=useState("choose");
  const [imgData,setImgData]=useState(null);
  const [mimeType,setMimeType]=useState("image/jpeg");
  const [aiNote,setAiNote]=useState(null);
  const [err,setErr]=useState(null);
  const fileRef=useRef();
  const blank={entity:"",comercio:"",rut_comercio:"",monto_total:"",monto_neto:"",iva:"",fecha:todayFn(),tipo_documento:"boleta",numero_documento:"",categoria:"Otro",descripcion:"",nota:""};
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

  const save=()=>{
    if(!form.entity){setErr("Seleccioná la entidad");return;}
    if(!form.monto_total){setErr("Ingresá el monto total");return;}
    dispatch({type:"ADD_EXPENSE",payload:{
      id:Date.now(),...form,
      monto_total:parseInt(String(form.monto_total).replace(/\D/g,""))||0,
      monto_neto:parseInt(String(form.monto_neto).replace(/\D/g,""))||0,
      iva:parseInt(String(form.iva).replace(/\D/g,""))||0,
      imageUrl:imgData?.url||null,createdAt:new Date().toISOString(),
    }});
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

  if(step==="analyzing") return (
    <div style={{...S.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"65vh",gap:18}}>
      <div style={S.spinner}/>
      <div style={{fontFamily:"'Georgia',serif",fontSize:19,color:"#1a5276"}}>Analizando comprobante…</div>
      <div style={{fontSize:13,color:"#aaa"}}>Extrayendo monto, IVA, fecha, comercio y RUT</div>
    </div>
  );

  return (
    <div style={S.page}>
      <TopBar title="Clasificar Gasto" onBack={()=>setStep(imgData?"preview":"choose")}/>
      {imgData&&<img src={imgData.url} alt="" style={{width:"100%",maxHeight:110,objectFit:"contain",borderRadius:10,background:"#f0f0f0",marginBottom:12}}/>}
      {aiNote&&<div style={{borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,fontWeight:600,background:aiNote==="alta"?"#e8f5e9":"#fff8e1",color:aiNote==="alta"?"#2e7d32":"#e65100"}}>{aiNote==="alta"?"✅":"⚠️"} Datos con confianza {aiNote}. Verificá antes de guardar.</div>}
      {err&&<div style={{background:"#fde8e8",color:"#b00020",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,fontWeight:600}}>{err}</div>}

      <div style={S.group}>
        <div style={S.label}>¿A qué entidad corresponde? *</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {entities.map(e=>(
            <button key={e.id} onClick={()=>setForm(f=>({...f,entity:e.id}))}
              style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderRadius:12,border:`2px solid ${form.entity===e.id?e.color:"#e0e0e0"}`,background:form.entity===e.id?e.color+"15":"#fff",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{fontSize:24}}>{e.icon}</span>
              <span style={{fontWeight:700,color:e.color,fontSize:14,flex:1,textAlign:"left"}}>{e.label}</span>
              {form.entity===e.id&&<span style={{color:e.color,fontWeight:700}}>✓</span>}
            </button>
          ))}
        </div>
      </div>
      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Tipo documento</div><select style={S.input} value={form.tipo_documento} onChange={upd("tipo_documento")}>{["boleta","factura","ticket","recibo","otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        <div style={{flex:1}}><div style={S.label}>N° documento</div><input style={S.input} value={form.numero_documento} onChange={upd("numero_documento")} placeholder="ej: 00123456"/></div>
      </div>
      <div style={S.group}><div style={S.label}>Comercio / Proveedor</div><input style={S.input} value={form.comercio} onChange={upd("comercio")} placeholder="ej: Copec, Sodimac..."/></div>
      <div style={S.group}><div style={S.label}>RUT del comercio</div><input style={S.input} value={form.rut_comercio} onChange={upd("rut_comercio")} placeholder="ej: 76.123.456-7"/></div>
      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Monto neto</div><input style={S.input} type="number" value={form.monto_neto} onChange={upd("monto_neto")} placeholder="0"/></div>
        <div style={{flex:1}}><div style={S.label}>IVA (19%)</div><input style={S.input} type="number" value={form.iva} onChange={upd("iva")} placeholder="0"/></div>
      </div>
      <div style={S.group}><div style={S.label}>Monto total *</div><input style={{...S.input,fontSize:18,fontWeight:700}} type="number" value={form.monto_total} onChange={upd("monto_total")} placeholder="0"/></div>
      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Fecha</div><input style={S.input} type="date" value={form.fecha} onChange={upd("fecha")}/></div>
        <div style={{flex:1}}><div style={S.label}>Categoría</div><select style={S.input} value={form.categoria} onChange={upd("categoria")}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div style={S.group}><div style={S.label}>Descripción</div><input style={S.input} value={form.descripcion} onChange={upd("descripcion")} placeholder="Breve descripción..."/></div>
      <div style={S.group}><div style={S.label}>Nota para el contador</div><textarea style={{...S.input,height:64,resize:"none"}} value={form.nota} onChange={upd("nota")} placeholder="Comentario adicional..."/></div>
      <button style={S.btn} onClick={save}>💾 Guardar Gasto</button>
      <div style={{height:40}}/>
    </div>
  );
}

// ─── REPORT ───────────────────────────────────────────────────────────────────
function ReportScreen({state,dispatch,nav,initParams}) {
  const {expenses,entities,categories}=state;
  const [filterEntity,setFilterEntity]=useState(initParams?.entity||"all");
  const [filterMonth,setFilterMonth]=useState("all");
  const [deleting,setDeleting]=useState(null);
  const [exporting,setExporting]=useState(null);

  const allMonths=[...new Set(expenses.map(e=>e.fecha?.slice(0,7)).filter(Boolean))].sort().reverse();
  const filtered=expenses.filter(e=>{
    const eOk=filterEntity==="all"||e.entity===filterEntity;
    const mOk=filterMonth==="all"||e.fecha?.startsWith(filterMonth);
    return eOk&&mOk;
  });
  const total=filtered.reduce((s,x)=>s+(x.monto_total||0),0);
  const totalIva=filtered.reduce((s,x)=>s+(x.iva||0),0);
  const totalNeto=filtered.reduce((s,x)=>s+(x.monto_neto||0),0);
  const byCat=categories.map(cat=>({cat,total:filtered.filter(e=>e.categoria===cat).reduce((s,x)=>s+(x.monto_total||0),0),count:filtered.filter(e=>e.categoria===cat).length})).filter(x=>x.count>0).sort((a,b)=>b.total-a.total);

  const runExport=async(type)=>{
    setExporting(type);
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
      const entLabel=filterEntity==="all"?"Todas":entities.find(e=>e.id===filterEntity)?.label||"";
      const monLabel=filterMonth==="all"?"Todos":filterMonth;
      if(type==="excel") await buildExcel(filterMonth||"filtro", filtered, entities);
      else {
        const entForPDF = filterEntity==="all" ? {id:"all",label:"Todos los gastos",color:"#1a5276",icon:"📊"} : entities.find(e=>e.id===filterEntity);
        await buildEntityPDF(filtered, entForPDF, `${entLabel} — ${monLabel}`);
      }
    } catch(e){ alert("Error: "+e.message); }
    setExporting(null);
  };

  return (
    <div style={S.page}>
      <TopBar title="Reporte" onBack={()=>nav("home")} right={
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>runExport("excel")} disabled={!!exporting} style={{background:"#1a7a4a",color:"#fff",border:"none",borderRadius:9,padding:"7px 10px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",opacity:exporting?0.6:1}}>{exporting==="excel"?"…":"📊"}</button>
          <button onClick={()=>runExport("pdf")}   disabled={!!exporting} style={{background:"#c0392b",color:"#fff",border:"none",borderRadius:9,padding:"7px 10px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",opacity:exporting?0.6:1}}>{exporting==="pdf"?"…":"📄"}</button>
        </div>
      }/>
      <div style={S.row}>
        <div style={{flex:1}}><div style={S.label}>Entidad</div><select style={S.input} value={filterEntity} onChange={e=>setFilterEntity(e.target.value)}><option value="all">Todas</option>{entities.map(e=><option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}</select></div>
        <div style={{flex:1}}><div style={S.label}>Período</div><select style={S.input} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}><option value="all">Todos</option>{allMonths.map(m=><option key={m} value={m}>{ym2label(m)}</option>)}</select></div>
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
      {byCat.length>0&&<>{<div style={S.sectionLabel}>Por categoría</div>}{byCat.map(c=>(
        <div key={c.cat} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f0f0f0"}}>
          <span style={{fontSize:14,fontWeight:600}}>{c.cat} <span style={{color:"#ccc",fontWeight:400}}>({c.count})</span></span>
          <span style={{fontFamily:"'Georgia',serif",fontWeight:700}}>{clp(c.total)}</span>
        </div>
      ))}</>}
      <div style={{...S.sectionLabel,marginTop:20}}>Comprobantes</div>
      {filtered.length===0&&<div style={S.empty}><div>Sin gastos con estos filtros</div></div>}
      {[...filtered].reverse().map(exp=>{
        const ent=entities.find(e=>e.id===exp.entity);
        return (
          <div key={exp.id} style={{...S.card,borderLeft:`4px solid ${ent?.color||"#ccc"}`}}>
            <div style={{display:"flex",gap:10}}>
              {exp.imageUrl&&<img src={exp.imageUrl} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:8,flexShrink:0}}/>}
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
                  <button onClick={()=>setDeleting(exp.id)} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:14,padding:"2px 4px"}}>🗑️</button>
                </div>
              </div>
            </div>
            {deleting===exp.id&&(
              <div style={{background:"#fde8e8",borderRadius:8,padding:"10px",marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,color:"#b00020",flex:1}}>¿Eliminar este gasto?</span>
                <button onClick={()=>{dispatch({type:"DELETE_EXPENSE",payload:exp.id});setDeleting(null);}} style={{background:"#b00020",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Eliminar</button>
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

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsScreen({state,dispatch,nav}) {
  const {entities,categories,settings={}}=state;
  const [tab,setTab]=useState("general");
  const [newEnt,setNewEnt]=useState({label:"",icon:"📁",color:PALETTE[0]});
  const [newCat,setNewCat]=useState("");
  const [sett,setSett]=useState({contadorEmail:settings.contadorEmail||"",nombreEmpresa:settings.nombreEmpresa||""});

  const saveSett=()=>{dispatch({type:"UPDATE_SETTINGS",payload:sett}); alert("Configuración guardada ✓");};

  return (
    <div style={S.page}>
      <TopBar title="Configuración" onBack={()=>nav("home")}/>
      <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto"}}>
        {[["general","⚙️ General"],["entities","🏢 Entidades"],["categories","🏷️ Categorías"]].map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"9px 6px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:tab===t?"#1a5276":"#f0f0f0",color:tab===t?"#fff":"#555",fontFamily:"inherit",whiteSpace:"nowrap"}}>{label}</button>
        ))}
      </div>

      {tab==="general"&&(
        <>
          <div style={S.group}><div style={S.label}>Nombre de tu empresa / persona</div><input style={S.input} value={sett.nombreEmpresa} onChange={e=>setSett(s=>({...s,nombreEmpresa:e.target.value}))} placeholder="ej: Juan Pérez / Mis Empresas"/></div>
          <div style={S.group}><div style={S.label}>Email del contador (para cierre mensual)</div><input style={S.input} type="email" value={sett.contadorEmail} onChange={e=>setSett(s=>({...s,contadorEmail:e.target.value}))} placeholder="contador@ejemplo.com"/></div>
          <button style={S.btn} onClick={saveSett}>Guardar configuración</button>
        </>
      )}

      {tab==="entities"&&(
        <>
          <div style={S.sectionLabel}>Entidades actuales</div>
          {entities.map(e=>(
            <div key={e.id} style={{...S.card,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>{e.icon}</span>
              <span style={{fontWeight:700,color:e.color,flex:1,fontSize:14}}>{e.label}</span>
              <button onClick={()=>dispatch({type:"REMOVE_ENTITY",payload:e.id})} style={{background:"#fde8e8",color:"#b00020",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Eliminar</button>
            </div>
          ))}
          <div style={{...S.sectionLabel,marginTop:16}}>Nueva entidad</div>
          <div style={S.group}><div style={S.label}>Nombre</div><input style={S.input} value={newEnt.label} onChange={e=>setNewEnt(n=>({...n,label:e.target.value}))} placeholder="ej: Gastos Auto, Casa..."/></div>
          <div style={S.row}>
            <div style={{flex:1}}><div style={S.label}>Ícono</div><input style={S.input} value={newEnt.icon} onChange={e=>setNewEnt(n=>({...n,icon:e.target.value}))}/></div>
            <div style={{flex:1}}><div style={S.label}>Color</div><div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:4}}>{PALETTE.map(c=><div key={c} onClick={()=>setNewEnt(n=>({...n,color:c}))} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",border:newEnt.color===c?"3px solid #111":"2px solid transparent"}}/>)}</div></div>
          </div>
          <button style={S.btn} onClick={()=>{if(!newEnt.label.trim())return;dispatch({type:"ADD_ENTITY",payload:{id:"e_"+Date.now(),...newEnt}});setNewEnt({label:"",icon:"📁",color:PALETTE[0]});}}>+ Agregar entidad</button>
        </>
      )}

      {tab==="categories"&&(
        <>
          <div style={S.sectionLabel}>Categorías activas</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
            {categories.map(c=>(
              <div key={c} style={{display:"flex",alignItems:"center",gap:4,background:"#f0f0f0",borderRadius:20,padding:"5px 10px 5px 12px"}}>
                <span style={{fontSize:13,fontWeight:600}}>{c}</span>
                <button onClick={()=>dispatch({type:"REMOVE_CATEGORY",payload:c})} style={{background:"none",border:"none",cursor:"pointer",color:"#bbb",fontSize:15,padding:0,lineHeight:1}}>✕</button>
              </div>
            ))}
          </div>
          <div style={S.sectionLabel}>Nueva categoría</div>
          <div style={{display:"flex",gap:8}}>
            <input style={{...S.input,flex:1}} value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="ej: Farmacia, Hotel..." onKeyDown={e=>{if(e.key==="Enter"&&newCat.trim()){dispatch({type:"ADD_CATEGORY",payload:newCat.trim()});setNewCat("");}}}/>
            <button style={{...S.btn,width:"auto",padding:"0 18px"}} onClick={()=>{if(!newCat.trim())return;dispatch({type:"ADD_CATEGORY",payload:newCat.trim()});setNewCat("");}}>+</button>
          </div>
        </>
      )}
      <div style={{height:40}}/>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [state,dispatch]=useReducer(appReducer,null,()=>load()||DEFAULT_STATE);
  const [screen,setScreen]=useState("home");
  const [screenParams,setParams]=useState({});
  const nav=useCallback((s,params={})=>{setScreen(s);setParams(params||{});});
  const common={state,dispatch,nav};
  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:480,margin:"0 auto",background:"#f7f5f0",minHeight:"100vh"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input:focus,select:focus,textarea:focus{outline:2px solid #1a5276;outline-offset:1px;}@keyframes spin{to{transform:rotate(360deg);}}button:active{opacity:.85;}`}</style>
      {screen==="home"     &&<HomeScreen     {...common}/>}
      {screen==="capture"  &&<CaptureScreen  {...common}/>}
      {screen==="report"   &&<ReportScreen   {...common} initParams={screenParams}/>}
      {screen==="close"    &&<CloseScreen    {...common} initParams={screenParams}/>}
      {screen==="settings" &&<SettingsScreen {...common}/>}
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
