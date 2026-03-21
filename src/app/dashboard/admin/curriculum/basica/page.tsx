"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, addDoc } from "firebase/firestore";
import Link from "next/link";

export default function EditorBasica() {
  const [loading, setLoading] = useState(false);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [especialidad, setEspecialidad] = useState(""); // Usamos 'especialidad' en DB, pero UI dice Asignatura
  
  const unidadBase = {
    nombre: "",
    curso: "1° Básico",
    oaEspecialidad: [""], // Usado para Objetivos Transversales/Generales
    aprendizajes: [{ textoAE: "", criterios: [{ textoCE: "", genericosAsociados: [] as string[] }] }]
  };
  
  const [unidades, setUnidades] = useState([unidadBase]);
  const [modulosAbiertos, setModulosAbiertos] = useState<number[]>([0]);

  useEffect(() => {
    const borrador = localStorage.getItem("basica_borrador");
    if (borrador) { try { const data = JSON.parse(borrador); if (data.especialidad) setEspecialidad(data.especialidad); if (data.unidades) setUnidades(data.unidades); } catch (e) {} }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { localStorage.setItem("basica_borrador", JSON.stringify({ especialidad, unidades })); }, 1000); 
    return () => clearTimeout(timer);
  }, [especialidad, unidades]);

  const handleSubirDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // La misma lógica de subida, pero normalizamos hacia 'unidades'
    const file = e.target.files?.[0]; if (!file) return; setProcesandoArchivo(true);
    try {
      const formData = new FormData(); formData.append("file", file);
      const response = await fetch("/api/generate", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Error servidor");
      const dataIA = await response.json();
      if (dataIA.especialidad) setEspecialidad(dataIA.especialidad.toUpperCase());
      const raw = dataIA.modulos || dataIA.malla || dataIA.unidades || [];
      if (Array.isArray(raw)) {
        const norm = raw.map((m: any) => ({
          nombre: m.nombre || "Nueva Unidad", curso: m.curso || "1° Básico",
          oaEspecialidad: Array.isArray(m.oaEspecialidad) ? m.oaEspecialidad : [m.oaEspecialidad || ""],
          aprendizajes: (m.aprendizajes || []).map((ae: any) => ({
            textoAE: ae.textoAE || ae.titulo || "",
            criterios: (ae.criterios || []).map((ce: any) => ({ textoCE: ce.textoCE || ce.descripcion || "", genericosAsociados: [] }))
          }))
        }));
        setUnidades(norm); setModulosAbiertos(norm.map((_, i) => i)); alert("✅ Unidades Básica cargadas");
      }
    } catch (error: any) { alert("❌ Error"); } finally { setProcesandoArchivo(false); e.target.value = ''; }
  };

  const handleGuardarTodo = async () => {
    if (!especialidad) return alert("Ingresa la asignatura");
    setLoading(true);
    try {
      await addDoc(collection(db, "curriculum"), {
        tipoFormacion: "Formación General Básica", tipo: "GENERAL", especialidad, genericosMaestros: [], malla: unidades, updatedAt: new Date().toISOString()
      });
      alert("✅ Guardado"); localStorage.removeItem("basica_borrador"); 
    } catch (e) { alert("❌ Error"); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 pb-32">
      <div className="fixed top-4 right-4 z-50 flex gap-4"><Link href="/dashboard/admin/curriculum" className="bg-white border text-slate-600 px-4 py-2 rounded-full text-xs font-bold shadow-sm">⬅ Volver</Link></div>
      <div className="max-w-6xl mx-auto space-y-8 mt-10">
        <div className="bg-emerald-50/50 p-8 rounded-[2rem] border-2 border-dashed border-emerald-300 text-center space-y-4">
          <h3 className="text-xl font-black text-emerald-900">IA - Educación Básica 🎒</h3>
          <label className="cursor-pointer inline-block bg-emerald-600 text-white px-8 py-4 rounded-full font-black text-sm">{procesandoArchivo ? "Analizando..." : "Subir Programa Básica"}<input type="file" className="hidden" onChange={handleSubirDocumento}/></label>
        </div>

        <div className="bg-white p-6 rounded-[3.5rem] shadow-sm border-2 border-slate-100">
          <h1 className="text-3xl font-black uppercase italic text-slate-800 mb-6">Editor <span className="text-emerald-600">Básica</span></h1>
          <input className="w-full p-5 bg-slate-50 rounded-[2rem] font-bold outline-none text-lg" placeholder="NOMBRE ASIGNATURA (Ej: Lenguaje)" value={especialidad} onChange={e => setEspecialidad(e.target.value)} />
        </div>

        <div className="space-y-4">
          {unidades.map((uni, uIdx) => {
            const isAbierto = modulosAbiertos.includes(uIdx);
            return (
              <div key={uIdx} className="bg-white rounded-[3.5rem] border-2 border-slate-200 overflow-hidden">
                <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => setModulosAbiertos(prev => prev.includes(uIdx) ? prev.filter(i => i !== uIdx) : [...prev, uIdx])}>
                  <div className="flex-1 flex gap-4"><div className="w-12 h-12 bg-emerald-600 text-white flex items-center justify-center rounded-2xl font-black">{uIdx + 1}</div>
                    <input className="text-xl font-black outline-none uppercase bg-transparent w-full" placeholder="NUEVA UNIDAD" value={uni.nombre} onClick={e => e.stopPropagation()} onChange={e => { const n = [...unidades]; n[uIdx].nombre = e.target.value; setUnidades(n); }}/>
                  </div>
                  <select className="p-3 bg-slate-100 rounded-xl font-bold" value={uni.curso} onClick={e => e.stopPropagation()} onChange={e => { const n = [...unidades]; n[uIdx].curso = e.target.value; setUnidades(n); }}>
                    {["1° Básico","2° Básico","3° Básico","4° Básico","5° Básico","6° Básico","7° Básico","8° Básico"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {isAbierto && (
                  <div className="p-6 border-t border-slate-100 space-y-8">
                    {uni.aprendizajes.map((ae, aeIdx) => (
                      <div key={aeIdx} className="bg-emerald-50/50 p-6 rounded-[3rem] border border-emerald-100">
                        <label className="text-[10px] font-black text-emerald-700">OBJETIVO DE APRENDIZAJE (OA)</label>
                        <textarea className="w-full mt-2 p-4 rounded-2xl text-sm font-bold bg-white" placeholder="Ej: Leer comprensivamente..." value={ae.textoAE} onChange={e => { const n = [...unidades]; n[uIdx].aprendizajes[aeIdx].textoAE = e.target.value; setUnidades(n); }} />
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          {ae.criterios.map((ce, ceIdx) => (
                            <div key={ceIdx} className="bg-white p-4 rounded-2xl shadow-sm"><span className="text-[9px] font-black text-slate-500">INDICADOR DE EVALUACIÓN</span>
                              <textarea className="w-full p-2 text-[11px] bg-slate-50 rounded-xl mt-2" value={ce.textoCE} onChange={e => { const n = [...unidades]; n[uIdx].aprendizajes[aeIdx].criterios[ceIdx].textoCE = e.target.value; setUnidades(n); }} />
                            </div>
                          ))}
                          <button onClick={() => { const n = [...unidades]; n[uIdx].aprendizajes[aeIdx].criterios.push({textoCE:"", genericosAsociados:[]}); setUnidades(n); }} className="border-2 border-dashed rounded-2xl text-[10px] font-black text-slate-400 hover:bg-slate-50">+ INDICADOR</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => { const n = [...unidades]; n[uIdx].aprendizajes.push({textoAE:"", criterios:[{textoCE:"", genericosAsociados:[]}]}); setUnidades(n); }} className="bg-slate-900 text-white px-4 py-2 rounded-full text-[10px] font-black">+ NUEVO OA</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={() => { setUnidades([...unidades, unidadBase]); setModulosAbiertos([...modulosAbiertos, unidades.length]); }} className="w-full py-8 border-4 border-dashed rounded-[3rem] font-black text-slate-400">+ AÑADIR UNIDAD</button>
        <button onClick={handleGuardarTodo} disabled={loading} className="w-full bg-slate-900 text-white py-8 rounded-[3.5rem] font-black text-xl hover:bg-emerald-600">{loading ? "GUARDANDO..." : "GUARDAR PROGRAMA BÁSICA"}</button>
      </div>
    </div>
  );
}