"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, addDoc } from "firebase/firestore";
import Link from "next/link";

export default function EditorTP() {
  const [loading, setLoading] = useState(false);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [especialidad, setEspecialidad] = useState("");
  const letras = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const [listaGenericos, setListaGenericos] = useState<string[]>(Array(12).fill(""));

  const moduloBase = {
    nombre: "",
    curso: "3° Medio",
    oaEspecialidad: [""],
    aprendizajes: [{ textoAE: "", criterios: [{ textoCE: "", genericosAsociados: [] as string[] }] }]
  };
  
  const [modulos, setModulos] = useState([moduloBase]);
  const [modulosAbiertos, setModulosAbiertos] = useState<number[]>([0]);
  const [guardadoLocal, setGuardadoLocal] = useState(false);

  // ==========================================
  // AUTO-GUARDADO Y BORRADOR LOCAL
  // ==========================================
  useEffect(() => {
    const borrador = localStorage.getItem("tp_borrador");
    if (borrador) {
      try {
        const data = JSON.parse(borrador);
        if (data.especialidad) setEspecialidad(data.especialidad);
        if (data.listaGenericos) setListaGenericos(data.listaGenericos);
        if (data.modulos) setModulos(data.modulos);
      } catch (e) {
        console.error("Error cargando borrador:", e);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("tp_borrador", JSON.stringify({ especialidad, listaGenericos, modulos }));
      setGuardadoLocal(true);
      setTimeout(() => setGuardadoLocal(false), 2000); 
    }, 1000); 
    return () => clearTimeout(timer);
  }, [especialidad, listaGenericos, modulos]);

  const limpiarBorrador = () => {
    if (confirm("¿Estás seguro de borrar todo el progreso? Esta acción no se puede deshacer.")) {
      localStorage.removeItem("tp_borrador");
      setEspecialidad(""); 
      setListaGenericos(Array(12).fill("")); 
      setModulos([moduloBase]); 
      setModulosAbiertos([0]);
    }
  };

  // ==========================================
  // PROCESAMIENTO CON IA
  // ==========================================
  const handleSubirDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcesandoArchivo(true);
    
    try {
      const formData = new FormData(); 
      formData.append("file", file);
      
      const response = await fetch("/api/generate", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Error del servidor al procesar el archivo.");
      
      const dataIA = await response.json();
      
      if (dataIA.especialidad) setEspecialidad(dataIA.especialidad.toUpperCase());
      const raw = dataIA.modulos || dataIA.malla || [];
      
      if (Array.isArray(raw)) {
        const normalizados = raw.map((m: any) => ({
          nombre: m.nombre || "Módulo Nuevo", 
          curso: m.curso || "3° Medio",
          oaEspecialidad: Array.isArray(m.oaEspecialidad) && m.oaEspecialidad.length > 0 ? m.oaEspecialidad : [""],
          aprendizajes: Array.isArray(m.aprendizajes) ? m.aprendizajes.map((ae: any) => ({
            textoAE: ae.textoAE || ae.titulo || "",
            criterios: Array.isArray(ae.criterios) ? ae.criterios.map((ce: any) => ({
              textoCE: ce.textoCE || ce.descripcion || "",
              genericosAsociados: Array.isArray(ce.genericosAsociados) ? ce.genericosAsociados.filter((l: string) => /^[A-L]$/.test(l)) : []
            })) : [{ textoCE: "", genericosAsociados: [] }]
          })) : [{ textoAE: "", criterios: [{ textoCE: "", genericosAsociados: [] }] }]
        }));

        const validos = normalizados.filter(m => m.nombre !== "Módulo Nuevo" || m.aprendizajes.length > 0);
        
        if (validos.length > 0) { 
          setModulos(validos); 
          setModulosAbiertos(validos.map((_, i) => i)); 
          alert(`✅ ¡Éxito! Se han estructurado ${validos.length} módulos desde el documento.`); 
        }
      }
    } catch (error: any) { 
      alert("❌ Error al leer el documento: " + error.message); 
    } finally { 
      setProcesandoArchivo(false); 
      e.target.value = ''; 
    }
  };

  // ==========================================
  // GUARDAR EN BASE DE DATOS
  // ==========================================
  const handleGuardarTodo = async () => {
    if (!especialidad.trim()) return alert("Por favor, ingresa el nombre de la especialidad antes de guardar.");
    setLoading(true);
    try {
      await addDoc(collection(db, "curriculum"), {
        tipoFormacion: "Formación TP", 
        tipo: "EMTP", 
        especialidad: especialidad.trim(),
        genericosMaestros: listaGenericos.map((text, i) => ({ letra: letras[i], texto: text })),
        malla: modulos, 
        updatedAt: new Date().toISOString()
      });
      alert("✅ Programa Curricular TP guardado con éxito."); 
      localStorage.removeItem("tp_borrador"); 
    } catch (e) { 
      alert("❌ Ocurrió un error al guardar en la base de datos."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans pb-32">
      {/* BARRA SUPERIOR FLOTANTE */}
      <div className="fixed top-4 right-4 z-50 flex gap-4 items-center">
        <Link href="/dashboard/admin/curriculum" className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-full text-xs font-bold shadow-sm hover:bg-slate-50 transition-all">
          ⬅ Volver al Menú
        </Link>
        {guardadoLocal && <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-xs font-bold shadow-sm animate-pulse">☁️ Borrador guardado</span>}
        <button onClick={limpiarBorrador} className="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-5 py-2.5 rounded-full text-xs font-bold shadow-sm transition-all">
          🗑️ Limpiar Todo
        </button>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 mt-10">
        
        {/* ZONA DE CARGA DE IA */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 md:p-12 rounded-[2rem] border-2 border-dashed border-blue-300 flex flex-col items-center text-center space-y-4 shadow-sm relative overflow-hidden">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-3xl mb-2 z-10">🤖</div>
          <div className="z-10">
            <h3 className="text-2xl font-black text-blue-900">Estructuración Mágica con IA</h3>
            <p className="text-slate-500 font-medium mt-2 max-w-lg mx-auto text-sm">
              Sube el PDF oficial del Ministerio. Nuestra IA leerá el documento y extraerá automáticamente todos los módulos, aprendizajes y criterios de evaluación.
            </p>
          </div>
          
          <label className={`relative z-10 cursor-pointer mt-4 inline-flex items-center justify-center bg-blue-600 text-white px-8 py-4 rounded-full font-black text-sm shadow-lg hover:bg-blue-700 hover:scale-105 transition-all ${procesandoArchivo ? 'opacity-70 pointer-events-none animate-pulse' : ''}`}>
            {procesandoArchivo ? "⏳ Analizando Documento (Puede tardar un minuto)..." : "📄 Subir Programa Oficial (PDF/Word)"}
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleSubirDocumento} disabled={procesandoArchivo}/>
          </label>
          <div className="absolute -right-10 -bottom-10 opacity-5 text-[15rem] font-black pointer-events-none">TP</div>
        </div>

        {/* EDITOR PRINCIPAL */}
        <div className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-sm border border-slate-200">
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-800 mb-8 flex items-center gap-3">
            <span className="w-8 h-8 bg-blue-600 rounded-lg"></span> 
            Editor de <span className="text-blue-600">Especialidad</span>
          </h1>
          
          <div className="mb-10">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Nombre de la Especialidad</label>
            <input 
              className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-xl text-slate-800 outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-300 transition-all uppercase placeholder:text-slate-300" 
              placeholder="Ej: MECÁNICA AUTOMOTRIZ" 
              value={especialidad} 
              onChange={e => setEspecialidad(e.target.value)} 
            />
          </div>
          
          {/* OBJETIVOS GENÉRICOS */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <label className="text-xs font-black text-slate-800 uppercase tracking-widest">Objetivos Genéricos (A - L)</label>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">Opcional para vincular</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listaGenericos.map((g, i) => (
                <div key={i} className="flex gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
                  <span className="bg-white text-blue-600 w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-sm shadow-sm">{letras[i]}</span>
                  <textarea 
                    className="flex-1 p-2 bg-transparent text-xs font-medium resize-none outline-none leading-relaxed" 
                    placeholder={`Descripción del O.A. Genérico ${letras[i]}...`} 
                    value={g} 
                    onChange={e => { const n = [...listaGenericos]; n[i] = e.target.value; setListaGenericos(n); }} 
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LISTA DE MÓDULOS (ACORDEONES) */}
        <div className="space-y-6">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest pl-4">Módulos Técnicos</h2>
          
          {modulos.map((mod, mIdx) => {
            const isAbierto = modulosAbiertos.includes(mIdx);
            return (
              <div key={mIdx} className={`bg-white rounded-[3rem] shadow-sm border-2 transition-all duration-300 ${isAbierto ? 'border-blue-400' : 'border-slate-200 hover:border-blue-200'}`}>
                
                {/* CABECERA DEL MÓDULO */}
                <div className={`p-6 md:p-8 flex flex-col md:flex-row items-center justify-between cursor-pointer gap-4 ${isAbierto ? 'bg-slate-50/50 rounded-t-[3rem] border-b border-slate-100' : ''}`} onClick={() => setModulosAbiertos(prev => prev.includes(mIdx) ? prev.filter(i => i !== mIdx) : [...prev, mIdx])}>
                  <div className="flex-1 w-full flex items-center gap-5">
                    <div className={`w-14 h-14 flex items-center justify-center rounded-2xl font-black text-xl transition-colors ${isAbierto ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                      {mIdx + 1}
                    </div>
                    <div className="flex-1">
                      <input 
                        className={`w-full text-xl md:text-2xl font-black outline-none uppercase bg-transparent transition-colors ${isAbierto ? 'text-blue-900' : 'text-slate-700'}`} 
                        placeholder="NOMBRE DEL MÓDULO" 
                        value={mod.nombre} 
                        onClick={e => e.stopPropagation()} 
                        onChange={e => { const n = [...modulos]; n[mIdx].nombre = e.target.value; setModulos(n); }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <select 
                      className="p-3 bg-slate-100 rounded-xl font-bold text-slate-600 outline-none hover:bg-slate-200 cursor-pointer border-none" 
                      value={mod.curso} 
                      onClick={e => e.stopPropagation()} 
                      onChange={e => { const n = [...modulos]; n[mIdx].curso = e.target.value; setModulos(n); }}
                    >
                      <option>3° Medio</option>
                      <option>4° Medio</option>
                    </select>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); if(modulos.length > 1) setModulos(modulos.filter((_, i) => i !== mIdx)); }} 
                      className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors font-bold text-xs uppercase"
                      title="Eliminar Módulo"
                    >
                      Eliminar
                    </button>
                    
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-transform ${isAbierto ? 'rotate-180' : ''}`}>▼</div>
                  </div>
                </div>

                {/* CONTENIDO DEL MÓDULO */}
                {isAbierto && (
                  <div className="p-6 md:p-8 space-y-10">
                    
                    {/* OA ESPECIALIDAD */}
                    <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 bg-indigo-600 rounded-full"></span> O.A. de Especialidad (Del Perfil de Egreso)
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        {mod.oaEspecialidad.map((oa, oaIdx) => (
                          <div key={oaIdx} className="flex gap-3 items-start relative group">
                            <textarea 
                              className="w-full p-4 bg-white rounded-2xl text-xs font-medium border border-indigo-50 outline-none focus:ring-2 focus:ring-indigo-200 resize-none leading-relaxed min-h-[60px]" 
                              placeholder="Describe el objetivo de aprendizaje..."
                              value={oa} 
                              onChange={e => { const n = [...modulos]; n[mIdx].oaEspecialidad[oaIdx] = e.target.value; setModulos(n); }} 
                            />
                            <button 
                              onClick={() => { const n = [...modulos]; if(n[mIdx].oaEspecialidad.length > 1) { n[mIdx].oaEspecialidad.splice(oaIdx, 1); setModulos(n); } }} 
                              className="absolute right-2 top-2 p-2 bg-red-50 text-red-400 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => { const n = [...modulos]; n[mIdx].oaEspecialidad.push(""); setModulos(n); }} className="mt-4 text-[10px] font-black text-indigo-600 bg-white border border-indigo-200 px-4 py-2 rounded-full hover:bg-indigo-600 hover:text-white transition-colors">
                        + AGREGAR OTRO O.A.
                      </button>
                    </div>

                    {/* APRENDIZAJES ESPERADOS Y CRITERIOS */}
                    <div className="space-y-6">
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center justify-between">
                        <span>Aprendizajes Esperados (A.E.)</span>
                        <button onClick={() => { const n = [...modulos]; n[mIdx].aprendizajes.push({textoAE:"", criterios:[{textoCE:"", genericosAsociados:[]}]}); setModulos(n); }} className="bg-slate-900 text-white px-4 py-2 rounded-full text-[10px] hover:bg-blue-600 transition-colors">
                          + NUEVO A.E.
                        </button>
                      </h3>

                      {mod.aprendizajes.map((ae, aeIdx) => (
                        <div key={aeIdx} className="bg-blue-50/40 p-6 md:p-8 rounded-[2.5rem] border border-blue-100 relative group">
                          
                          <button 
                            onClick={() => { const n = [...modulos]; if(n[mIdx].aprendizajes.length > 1) { n[mIdx].aprendizajes.splice(aeIdx, 1); setModulos(n); } }} 
                            className="absolute top-6 right-6 px-3 py-1.5 bg-white border border-red-100 text-red-400 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          >
                            ELIMINAR A.E.
                          </button>

                          <div className="mb-6">
                            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest ml-2">Aprendizaje Esperado {aeIdx + 1}</label>
                            <textarea 
                              className="w-full mt-2 p-5 bg-white rounded-[1.5rem] text-sm font-bold shadow-sm border border-transparent focus:border-blue-300 focus:ring-4 focus:ring-blue-50 outline-none resize-none min-h-[80px]" 
                              placeholder="Ej: Ejecuta mediciones de parámetros..."
                              value={ae.textoAE} 
                              onChange={e => { const n = [...modulos]; n[mIdx].aprendizajes[aeIdx].textoAE = e.target.value; setModulos(n); }} 
                            />
                          </div>
                          
                          {/* CRITERIOS DE EVALUACIÓN */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {ae.criterios.map((ce, ceIdx) => (
                              <div key={ceIdx} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 relative">
                                
                                <div className="flex justify-between items-center mb-3">
                                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black tracking-wider">Criterio {ceIdx + 1}</span>
                                  <button 
                                    onClick={() => { const n = [...modulos]; if(n[mIdx].aprendizajes[aeIdx].criterios.length > 1) { n[mIdx].aprendizajes[aeIdx].criterios.splice(ceIdx, 1); setModulos(n); } }} 
                                    className="text-slate-300 hover:text-red-500 text-[10px] font-black px-2"
                                  >✕ QUITAR</button>
                                </div>
                                
                                <textarea 
                                  className="w-full p-4 text-xs font-medium bg-slate-50 rounded-2xl border border-transparent focus:border-blue-200 focus:bg-white outline-none resize-none min-h-[80px] leading-relaxed" 
                                  placeholder="Describe el criterio de evaluación..."
                                  value={ce.textoCE} 
                                  onChange={e => { const n = [...modulos]; n[mIdx].aprendizajes[aeIdx].criterios[ceIdx].textoCE = e.target.value; setModulos(n); }} 
                                />
                                
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                  <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest text-center">Vincular Letras (A-L)</p>
                                  <div className="flex flex-wrap justify-center gap-1.5">
                                    {letras.map(l => {
                                      const isActive = ce.genericosAsociados.includes(l);
                                      return (
                                        <button 
                                          key={l} 
                                          onClick={() => {
                                            const n = [...modulos]; 
                                            const act = n[mIdx].aprendizajes[aeIdx].criterios[ceIdx].genericosAsociados;
                                            n[mIdx].aprendizajes[aeIdx].criterios[ceIdx].genericosAsociados = isActive ? act.filter(x=>x!==l) : [...act, l]; 
                                            setModulos(n);
                                          }} 
                                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all border ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-110' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50'}`}
                                        >
                                          {l}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {/* BOTÓN AGREGAR CRITERIO */}
                            <button 
                              onClick={() => { const n = [...modulos]; n[mIdx].aprendizajes[aeIdx].criterios.push({textoCE:"", genericosAsociados:[]}); setModulos(n); }} 
                              className="h-full min-h-[180px] border-4 border-dashed border-slate-200 rounded-3xl text-[11px] font-black uppercase text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center"
                            >
                              + Agregar Criterio
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CONTROLES FINALES */}
        <div className="pt-8 space-y-4">
          <button 
            onClick={() => { setModulos([...modulos, moduloBase]); setModulosAbiertos([...modulosAbiertos, modulos.length]); }} 
            className="w-full py-8 border-4 border-dashed border-slate-300 rounded-[3rem] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-blue-600 hover:border-blue-300 transition-all text-sm"
          >
            + Añadir Nuevo Módulo
          </button>
          
          <button 
            onClick={handleGuardarTodo} 
            disabled={loading} 
            className="w-full relative group overflow-hidden bg-slate-900 text-white py-8 rounded-[3.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all text-xl disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
            <span className="relative flex items-center justify-center gap-3">
              {loading ? <><span className="animate-spin text-2xl">⚙️</span> Guardando y Estructurando...</> : "Guardar Programa Curricular"}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}