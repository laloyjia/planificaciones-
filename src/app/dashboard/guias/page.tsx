"use client";

import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { collection, onSnapshot } from "firebase/firestore"; 
import { db } from "@/lib/firebase/config"; 
import { useAuth } from "@/context/AuthContext"; 
import remarkGfm from "remark-gfm"; // Para que las tablas se vean perfectas

interface Criterio { textoCE: string; }
interface Aprendizaje { textoAE: string; criterios: Criterio[]; }
interface Modulo { nombre: string; aprendizajes: Aprendizaje[]; }

export default function GuiasPage() {
  const { profile, loading: authLoading } = useAuth();
  
  // Estados de Datos
  const [modulosDisponibles, setModulosDisponibles] = useState<Modulo[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  // Estados de Formulario
  const [formData, setFormData] = useState({
    modulo: "",
    ae: "",
    ce: "",
    contenido: "",
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [guiaGenerada, setGuiaGenerada] = useState("");
  const [copiado, setCopiado] = useState(false);

  // --- LOGICA DE FILTRADO DINÁMICO ---
  const aprendizajesFiltrados = useMemo(() => {
    const mod = modulosDisponibles.find(m => m.nombre === formData.modulo);
    return mod?.aprendizajes || [];
  }, [formData.modulo, modulosDisponibles]);

  const criteriosFiltrados = useMemo(() => {
    const ae = aprendizajesFiltrados.find(a => a.textoAE === formData.ae);
    return ae?.criterios || [];
  }, [formData.ae, aprendizajesFiltrados]);

  // --- CARGA DE FIREBASE ---
  useEffect(() => {
    if (!authLoading && profile?.modulosAsignados) {
      const unsubscribe = onSnapshot(collection(db, "curriculum"), (snapshot) => {
        let encontrados: Modulo[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const malla = (data.malla || data.modulos || []) as any[];
          malla.forEach((mod) => {
            if (profile.modulosAsignados?.includes(mod.nombre?.trim())) {
              encontrados.push(mod);
            }
          });
        });
        setModulosDisponibles(encontrados);
        setCargandoDatos(false);
      }, () => setCargandoDatos(false));
      return () => unsubscribe();
    }
  }, [profile, authLoading]);

  // --- LLAMADA A OPENAI ---
  const generarGuia = async () => {
    if (!formData.modulo || !formData.contenido) return;

    setIsGenerating(true);
    setGuiaGenerada(""); 

    const promptEstructurado = `
      Eres un Ingeniero y Pedagogo experto en Educación Técnica (EMTP). 
      Escribe una GUÍA DE APRENDIZAJE técnica y profesional en MARKDOWN.
      
      CONTEXTO:
      - Módulo: ${formData.modulo}
      - Objetivo (AE): ${formData.ae}
      - Indicador (CE): ${formData.ce}
      - Tema específico: ${formData.contenido}

      ESTRUCTURA OBLIGATORIA:
      # [TÍTULO TÉCNICO EN MAYÚSCULAS]
      ## 1. FUNDAMENTOS TEÓRICOS
      (Explicación técnica de nivel industrial)
      ## 2. SEGURIDAD Y HERRAMIENTAS
      (Listado de EPP y herramientas necesarias)
      ## 3. ACTIVIDAD PRÁCTICA / PROCEDIMIENTO
      (Pasos numerados claros y técnicos)
      ## 4. DESAFÍO TÉCNICO
      (Un problema o cálculo relacionado)
      ## 5. PAUTA DE EVALUACIÓN
      (Crea una tabla con 4 indicadores: Excelente, Suficiente, Insuficiente)
    `;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptEstructurado }),
      });

      const data = await response.json();

      // Extracción de contenido compatible con la API Route que creamos
      let rawContent = "";
      if (data.choices?.[0]?.message?.content) {
        rawContent = data.choices[0].message.content;
      } else if (data.guia) {
        rawContent = data.guia;
      }

      // Limpiar decoradores de markdown ``` que a veces envía la IA
      const cleanMarkdown = rawContent.replace(/```markdown|```json|```/gi, "").trim();
      
      if (cleanMarkdown) {
        setGuiaGenerada(cleanMarkdown);
      } else {
        throw new Error("Respuesta vacía");
      }

    } catch (error) {
      console.error("Error:", error);
      setGuiaGenerada("# ❌ Error de Conexión\nNo se pudo obtener respuesta de la IA. Revisa tu consola y la API Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading || cargandoDatos) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black text-slate-900 uppercase tracking-tighter">Sincronizando Curriculum...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans text-slate-900 pb-20">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* PANEL DE CONFIGURACIÓN */}
        <aside className="xl:col-span-4 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-slate-200 border border-white sticky top-8">
            <h2 className="text-2xl font-black uppercase italic mb-8 border-l-4 border-slate-900 pl-4">Redactor IA</h2>

            <div className="space-y-6">
              {/* Selector de Módulo */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Módulo Asignado</label>
                <select 
                  value={formData.modulo}
                  onChange={(e) => setFormData({...formData, modulo: e.target.value, ae: "", ce: ""})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-900 rounded-2xl font-bold text-sm transition-all outline-none"
                >
                  <option value="">Selecciona un módulo...</option>
                  {modulosDisponibles.map((m, i) => <option key={i} value={m.nombre}>{m.nombre}</option>)}
                </select>
              </div>

              {/* Selector de AE */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Aprendizaje Esperado (AE)</label>
                <select 
                  disabled={!formData.modulo}
                  value={formData.ae}
                  onChange={(e) => setFormData({...formData, ae: e.target.value, ce: ""})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-900 rounded-2xl font-bold text-sm transition-all outline-none disabled:opacity-30"
                >
                  <option value="">Selecciona AE...</option>
                  {aprendizajesFiltrados.map((ae, i) => <option key={i} value={ae.textoAE}>{ae.textoAE}</option>)}
                </select>
              </div>

              {/* Tema Libre */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">¿Qué quieres enseñar hoy?</label>
                <textarea 
                  value={formData.contenido}
                  onChange={(e) => setFormData({...formData, contenido: e.target.value})}
                  placeholder="Ej: Paso a paso para medir aislamiento en motores..."
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-900 rounded-2xl font-bold text-sm h-32 resize-none transition-all outline-none"
                />
              </div>

              <button 
                onClick={generarGuia}
                disabled={isGenerating || !formData.contenido}
                className={`w-full font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-xl ${isGenerating ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600 active:scale-95'}`}
              >
                {isGenerating ? (
                   <span className="flex items-center gap-2">
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                     REDACTANDO...
                   </span>
                ) : "✨ GENERAR GUÍA TÉCNICA"}
              </button>
            </div>
          </div>
        </aside>

        {/* VISTA PREVIA DEL DOCUMENTO */}
        <main className="xl:col-span-8">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[1000px] flex flex-col">
            
            <div className="px-8 py-4 bg-slate-50 border-b flex justify-between items-center">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              
              {guiaGenerada && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => { navigator.clipboard.writeText(guiaGenerada); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all"
                  >
                    {copiado ? "Copiado" : "Copiar MD"}
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all shadow-md"
                  >
                    Imprimir PDF
                  </button>
                </div>
              )}
            </div>

            <div className="p-10 md:p-20 flex-grow bg-white print:p-0 overflow-y-auto">
              {guiaGenerada ? (
                <article className="prose prose-slate max-w-none prose-h1:text-4xl prose-h1:font-black prose-h1:tracking-tighter prose-h1:uppercase prose-h2:text-xl prose-h2:font-black prose-h2:bg-slate-900 prose-h2:text-white prose-h2:p-3 prose-h2:rounded-lg prose-table:border-2 prose-table:border-slate-200">
                  
                  {/* ENCABEZADO INSTITUCIONAL */}
                  <header className="border-[6px] border-slate-900 p-8 mb-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 bg-slate-900 text-white text-[10px] font-black uppercase italic">
                      Material Docente
                    </div>
                    <div className="flex flex-col gap-1 mb-6">
                       <h4 className="text-[12px] font-black text-blue-600 uppercase tracking-[0.2em]">{formData.modulo || "Módulo Técnico"}</h4>
                       <h1 className="text-2xl font-black m-0 leading-tight">GUÍA DE TRABAJO TALLER</h1>
                    </div>
                    <div className="grid grid-cols-2 gap-8 border-t-2 border-slate-100 pt-6">
                      <div className="space-y-4">
                        <div className="border-b border-slate-200 pb-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase block">Nombre Estudiante</span>
                          <div className="h-4"></div>
                        </div>
                        <div className="border-b border-slate-200 pb-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase block">Docente Responsable</span>
                          <span className="text-xs font-bold">{profile?.nombre || "Cargando..."}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border-b border-slate-200 pb-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase block">Fecha</span>
                          <span className="text-xs font-bold">{new Date().toLocaleDateString()}</span>
                        </div>
                        <div className="bg-slate-50 border-2 border-slate-900 flex flex-col items-center justify-center rounded-xl">
                          <span className="text-[9px] font-black text-slate-900 uppercase">Nota</span>
                          <span className="text-xl font-black">---</span>
                        </div>
                      </div>
                    </div>
                  </header>

                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{guiaGenerada}</ReactMarkdown>
                </article>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-40">
                  <div className="w-24 h-24 mb-6 border-4 border-dashed border-slate-400 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Editor Listo</h3>
                  <p className="max-w-xs mx-auto text-sm font-bold">Selecciona un módulo y describe el tema para que la IA redacte el documento técnico.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        @media print {
          aside, button, .no-print { display: none !important; }
          main { width: 100% !important; grid-column: span 12 !important; }
          .bg-[#f1f5f9] { background: white !important; }
          .rounded-[2.5rem] { border-radius: 0 !important; border: none !important; box-shadow: none !important; }
          .prose { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}