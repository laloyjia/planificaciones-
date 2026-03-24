"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { collection, onSnapshot } from "firebase/firestore"; 
import { db } from "@/lib/firebase/config"; 
import { useAuth } from "@/context/AuthContext"; 
import remarkGfm from "remark-gfm";

interface Criterio { textoCE: string; }
interface Aprendizaje { textoAE: string; criterios: Criterio[]; }
interface Modulo { nombre: string; aprendizajes: Aprendizaje[]; }

export default function RecursosPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  
  // Estados de Datos
  const [modulosDisponibles, setModulosDisponibles] = useState<Modulo[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  // Estados de Formulario
  const [formData, setFormData] = useState({
    modulo: "",
    ae: "",
    tipoRecurso: "", // NUEVO: Determina qué generará la IA
    contenido: "",
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [recursoGenerado, setRecursoGenerado] = useState("");
  const [copiado, setCopiado] = useState(false);

  // --- LÓGICA DE FILTRADO DINÁMICO ---
  const aprendizajesFiltrados = useMemo(() => {
    const mod = modulosDisponibles.find(m => m.nombre === formData.modulo);
    return mod?.aprendizajes || [];
  }, [formData.modulo, modulosDisponibles]);

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

  // --- GENERADOR MULTI-PROMPT ---
  const generarRecurso = async () => {
    if (!formData.modulo || !formData.contenido || !formData.tipoRecurso) return;

    setIsGenerating(true);
    setRecursoGenerado(""); 

    // BASE DEL PROMPT
    let promptEstructurado = `
      Actúa como un Evaluador y Pedagogo experto en Educación Media Técnico Profesional (EMTP).
      DATOS: Módulo: ${formData.modulo} | AE: ${formData.ae || "No especificado"} | Tema: ${formData.contenido}.
      REGLAS: Usa Markdown puro. Usa lenguaje técnico e industrial. No saludes, empieza directo con el título en mayúsculas (# [TÍTULO]).
    `;

    // LÓGICA CONDICIONAL SEGÚN EL TIPO DE RECURSO ELEGIDO
    if (formData.tipoRecurso === "prueba") {
      promptEstructurado += `
        Tu tarea es crear una PRUEBA DE EVALUACIÓN TÉCNICA escrita.
        ESTRUCTURA:
        1. Crea un encabezado formal de evaluación.
        2. ÍTEM 1: Selección Múltiple. 5 preguntas de alto nivel técnico con 4 alternativas (a, b, c, d).
        3. ÍTEM 2: Verdadero o Falso. 5 afirmaciones complejas. Deben justificar las falsas.
        4. ÍTEM 3: Desarrollo / Análisis de Caso. 2 problemas prácticos o cálculos donde deban explicar el "por qué".
        5. --- LÍNEA DIVISORIA ---
        6. PAUTA DE CORRECCIÓN PARA EL DOCENTE: Escribe las respuestas correctas de la prueba al final del documento.
      `;
    } 
    else if (formData.tipoRecurso === "guia_practica") {
      promptEstructurado += `
        Tu tarea es crear una GUÍA DE TALLER / PRÁCTICA DE LABORATORIO enfocada en la acción.
        ESTRUCTURA:
        1. OBJETIVO DE LA PRÁCTICA.
        2. SEGURIDAD Y EPP (Tabla con equipos de protección y herramientas).
        3. PRECAUCIONES ANTES DE INICIAR (Viñetas).
        4. PROCEDIMIENTO PASO A PASO (Lista numerada detallada como un SOP industrial. Especifica qué medir, qué ensamblar o qué revisar).
        5. TABLA DE REGISTRO DE DATOS (Crea una tabla vacía para que el alumno anote sus mediciones o resultados durante la práctica).
        6. PREGUNTAS DE CIERRE Y CONCLUSIÓN.
      `;
    }
    else if (formData.tipoRecurso === "rubrica") {
      promptEstructurado += `
        Tu tarea es crear una RÚBRICA DE EVALUACIÓN TÉCNICA detallada para evaluar una actividad práctica o proyecto sobre el tema indicado.
        ESTRUCTURA:
        1. Describe brevemente la actividad a evaluar.
        2. MATRIZ DE RÚBRICA (Tabla obligatoria).
           Columnas: Criterio a Evaluar | Excelente (100%) | Bueno (70%) | Insuficiente (30%)
           Debes crear al menos 6 Criterios a evaluar (ej: Uso de EPP, Precisión técnica, Manejo de herramientas, Orden, etc.).
           Describe exactamente qué comportamiento se espera en cada celda.
      `;
    }
    else if (formData.tipoRecurso === "caso_estudio") {
      promptEstructurado += `
        Tu tarea es crear un CASO DE ESTUDIO INDUSTRIAL PARA RESOLUCIÓN DE PROBLEMAS (Troubleshooting).
        ESTRUCTURA:
        1. CONTEXTO DE LA EMPRESA (Inventa un escenario realista de una industria o taller).
        2. PLANTEAMIENTO DEL PROBLEMA / FALLA (Describe detalladamente qué falló, los síntomas del equipo y los parámetros actuales).
        3. DATOS TÉCNICOS ADICIONALES (Tabla o lista con valores de referencia, medidas tomadas por el operador, etc.).
        4. PREGUNTAS DE DIAGNÓSTICO (Para que el alumno resuelva en grupos: ¿Cuál es la causa raíz?, ¿Qué mediría primero?, Proponga una solución paso a paso).
      `;
    }

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Enviamos tipo: "guia" para que el backend nos devuelva texto markdown, no JSON
        body: JSON.stringify({ prompt: promptEstructurado, tipo: "guia" }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      let rawContent = data.guia || data.choices?.[0]?.message?.content || "";
      const cleanMarkdown = rawContent.replace(/^```markdown\n?/gi, "").replace(/^```\n?/gi, "").replace(/```$/gi, "").trim();
      
      if (cleanMarkdown) setRecursoGenerado(cleanMarkdown);
      else throw new Error("La IA no devolvió contenido válido.");

    } catch (error) {
      console.error("Error:", error);
      setRecursoGenerado("# ❌ Error de Conexión\nNo se pudo obtener el recurso.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading || cargandoDatos) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black text-emerald-900 uppercase tracking-tighter">Cargando Centro de Recursos...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 pb-20 print:bg-white print:pb-0">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8 print:p-0 print:gap-0 print:block">
        
        {/* PANEL DE CONFIGURACIÓN */}
        <aside className="xl:col-span-4 space-y-6 no-print">
          
          <button 
            onClick={() => router.push("/dashboard")} 
            className="group flex items-center gap-3 text-slate-500 hover:text-emerald-700 font-bold text-xs uppercase tracking-widest transition-all mb-2"
          >
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-200 group-hover:border-emerald-400 group-hover:-translate-x-1 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </div>
            Volver al Inicio
          </button>

          <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-8">
            <h2 className="text-2xl font-black uppercase italic mb-8 border-l-4 border-emerald-500 pl-4 text-slate-800">Crear Recurso IA</h2>

            <div className="space-y-6">
              
              {/* SELECTOR DE TIPO DE RECURSO (NUEVO) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-emerald-600 uppercase ml-2 tracking-wider">¿Qué necesitas crear?</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "guia_practica", icon: "🔧", label: "Guía de Taller" },
                    { id: "prueba", icon: "📝", label: "Prueba Escrita" },
                    { id: "rubrica", icon: "📊", label: "Rúbrica" },
                    { id: "caso_estudio", icon: "🏭", label: "Caso de Estudio" },
                  ].map((tipo) => (
                    <button
                      key={tipo.id}
                      onClick={() => setFormData({ ...formData, tipoRecurso: tipo.id })}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                        formData.tipoRecurso === tipo.id 
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md" 
                          : "border-slate-100 bg-slate-50 text-slate-500 hover:border-emerald-200 hover:bg-white"
                      }`}
                    >
                      <span className="text-2xl">{tipo.icon}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-center">{tipo.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Módulo Asignado</label>
                <select 
                  value={formData.modulo}
                  onChange={(e) => setFormData({...formData, modulo: e.target.value, ae: ""})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl font-bold text-sm transition-all outline-none text-slate-700"
                >
                  <option value="">Selecciona un módulo...</option>
                  {modulosDisponibles.map((m, i) => <option key={i} value={m.nombre}>{m.nombre}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Aprendizaje Esperado (Opcional)</label>
                <select 
                  disabled={!formData.modulo}
                  value={formData.ae}
                  onChange={(e) => setFormData({...formData, ae: e.target.value})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl font-bold text-sm transition-all outline-none disabled:opacity-40 text-slate-700"
                >
                  <option value="">Selecciona AE...</option>
                  {aprendizajesFiltrados.map((ae, i) => <option key={i} value={ae.textoAE}>{ae.textoAE}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Tema Específico a Evaluar/Practicar</label>
                <textarea 
                  value={formData.contenido}
                  onChange={(e) => setFormData({...formData, contenido: e.target.value})}
                  placeholder="Ej: Medición de voltaje y corriente en circuitos mixtos..."
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl font-bold text-sm h-24 resize-none transition-all outline-none text-slate-700"
                />
              </div>

              <button 
                onClick={generarRecurso}
                disabled={isGenerating || !formData.contenido || !formData.tipoRecurso || !formData.modulo}
                className={`w-full font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-lg ${isGenerating || !formData.contenido || !formData.tipoRecurso ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-emerald-600/30 active:scale-95'}`}
              >
                {isGenerating ? (
                   <span className="flex items-center gap-3">
                     <div className="w-5 h-5 border-4 border-emerald-300 border-t-white rounded-full animate-spin"></div>
                     GENERANDO...
                   </span>
                ) : "🚀 GENERAR DOCUMENTO"}
              </button>
            </div>
          </div>
        </aside>

        {/* VISTA PREVIA DEL DOCUMENTO */}
        <main className="xl:col-span-8 print:col-span-12">
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-200 overflow-hidden min-h-[1000px] flex flex-col mt-10 xl:mt-0 print:shadow-none print:border-none print:rounded-none print:m-0 print:min-h-0">
            
            <div className="px-8 py-4 bg-slate-50/80 backdrop-blur-md border-b flex justify-between items-center no-print sticky top-0 z-10">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400 border border-red-500/20" />
                <div className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-500/20" />
                <div className="w-3 h-3 rounded-full bg-green-400 border border-green-500/20" />
              </div>
              
              {recursoGenerado && (
                <div className="flex gap-3 items-center">
                  <button 
                    onClick={() => { navigator.clipboard.writeText(recursoGenerado); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
                    className="px-5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    {copiado ? "¡COPIADO!" : "COPIAR MD"}
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                    IMPRIMIR PDF
                  </button>
                </div>
              )}
            </div>

            <div className="p-10 md:p-16 lg:p-20 flex-grow bg-white print:p-0 overflow-y-auto">
              {recursoGenerado ? (
                <article className={`prose prose-slate max-w-none 
                  prose-h1:text-3xl prose-h1:font-black prose-h1:tracking-tighter prose-h1:uppercase prose-h1:mb-12 prose-h1:text-center
                  prose-h2:text-lg prose-h2:font-black prose-h2:bg-slate-100 prose-h2:text-slate-900 prose-h2:p-3 prose-h2:rounded-lg prose-h2:mt-12 prose-h2:border-l-4 prose-h2:border-emerald-500
                  prose-h3:text-base prose-h3:font-bold prose-h3:text-slate-800 prose-h3:border-b-2 prose-h3:border-slate-100 prose-h3:pb-2
                  prose-table:w-full prose-table:border-2 prose-table:border-slate-200 prose-table:rounded-xl prose-table:overflow-hidden prose-table:my-8
                  prose-th:bg-slate-50 prose-th:p-4 prose-th:text-left prose-th:uppercase prose-th:text-[11px] prose-th:tracking-wider prose-th:text-slate-600
                  prose-td:p-4 prose-td:border-b prose-td:border-slate-100 prose-td:text-sm
                  prose-hr:border-t-4 prose-hr:border-dashed prose-hr:border-slate-300 prose-hr:my-16
                  prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-emerald-900 prose-blockquote:font-medium
                  prose-li:marker:text-emerald-500
                  print:prose-h2:border-l-4 print:prose-h2:border-black print:prose-h2:rounded-none
                `}>
                  
                  {/* ENCABEZADO INSTITUCIONAL DINÁMICO */}
                  <header className="border-4 border-slate-900 p-8 mb-12 relative overflow-hidden print:border-[2px] print:rounded-none">
                    <div className="absolute top-0 right-0 px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest print:border-l-[2px] print:border-b-[2px] print:border-black print:bg-white print:text-black">
                      {formData.tipoRecurso.replace("_", " ")}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                      <div className="space-y-4">
                        <div className="border-b-2 border-slate-200 pb-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre Alumno/Grupo</span>
                          <div className="h-6"></div>
                        </div>
                        <div className="border-b-2 border-slate-200 pb-1 flex justify-between items-end">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Módulo</span>
                          <span className="text-xs font-bold text-slate-800 uppercase">{formData.modulo}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="border-b-2 border-slate-200 pb-1 flex flex-col justify-between">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Fecha</span>
                          <span className="text-xs font-bold text-slate-800 text-right">{new Date().toLocaleDateString()}</span>
                        </div>
                        <div className="border-2 border-slate-900 flex flex-col items-center justify-center p-2 print:border-black">
                          <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest mb-1">Nota/Puntaje</span>
                          <span className="text-xl font-black text-slate-200">---</span>
                        </div>
                      </div>
                    </div>
                  </header>

                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{recursoGenerado}</ReactMarkdown>
                </article>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-40">
                  <div className="w-28 h-28 mb-8 border-4 border-dashed border-emerald-200 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 mb-2">Centro de Recursos</h3>
                  <p className="max-w-md mx-auto text-sm font-medium text-slate-500 leading-relaxed">Selecciona qué tipo de material necesitas (Pruebas, Guías de Taller, Rúbricas o Casos de Estudio) y la IA estructurará el formato ideal al instante.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 1.5cm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          aside, button, .no-print { display: none !important; }
          main { width: 100% !important; max-width: 100% !important; display: block !important; margin: 0 !important; }
          .bg-\\[\\#f8fafc\\] { background: white !important; }
          article { font-size: 11pt; line-height: 1.5; }
          
          /* Evita cortes incómodos en impresión */
          h1, h2, h3, h4, h5 { page-break-after: avoid; }
          table, img, pre, blockquote { page-break-inside: avoid; }
          ul, ol { page-break-inside: auto; }
          li { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}