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

export default function GuiasPage() {
  const router = useRouter();
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

  // --- LÓGICA DE FILTRADO DINÁMICO ---
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

    // SUPER PROMPT: MODO LIBRO DE TEXTO UNIVERSITARIO / INGENIERÍA
    const promptEstructurado = `
      Actúa como un Autor Académico Senior, Investigador e Ingeniero experto en Educación Media Técnico Profesional (EMTP) y Educación Superior.
      Tu tarea es redactar un MANUAL TÉCNICO Y ENCICLOPÉDICO DE NIVEL AVANZADO. Este documento DEBE SER EXTREMADAMENTE LARGO, DETALLADO Y PROFUNDO. 
      PROHIBIDO ENTREGAR RESPUESTAS BÁSICAS O RESUMIDAS. Escribe como si fuera un libro de texto de ingeniería.

      DATOS CURRICULARES:
      - Módulo: ${formData.modulo}
      - Aprendizaje Esperado (AE): ${formData.ae || "No especificado"}
      - Tema central a investigar: ${formData.contenido}

      REGLAS ESTRICTAS DE FORMATO Y MULTIMEDIA:
      - Tono: Ultra-profesional, académico, lenguaje técnico estricto.
      - Extensión Masiva: Desglosa cada concepto. Explica el origen, el funcionamiento microscópico/físico, las variantes industriales y el futuro de la tecnología.
      - SEPARACIÓN CLARA: Debes usar la línea divisoria "---" obligatoriamente antes de comenzar CADA NUEVO TÍTULO (##) para separar visualmente los ítems.
      - IMÁGENES Y DIAGRAMAS (RECURSO EXTERNO): En cada sección, incluye un enlace funcional estructurado para que el alumno pueda ver imágenes reales y diagramas. 
        Usa EXACTAMENTE este formato Markdown adaptando la "PALABRA_CLAVE" al tema específico de esa sección (reemplaza los espacios por +):
        [🖼️ Haz clic aquí para buscar esquemas y diagramas técnicos de "PALABRA_CLAVE" en Google Imágenes](https://www.google.com/search?tbm=isch&q=diagrama+tecnico+PALABRA_CLAVE)
      
      ESTRUCTURA OBLIGATORIA DEL DOCUMENTO:

      # [TÍTULO DEL TRATADO TÉCNICO EN MAYÚSCULAS]
      
      ---
      
      ## 🔬 1. FUNDAMENTOS CIENTÍFICOS Y MARCO TEÓRICO COMPLETO
      (Explicación masiva y profunda. Historia, evolución, física, termodinámica, química o matemáticas aplicadas al tema. Mínimo 4 o 5 párrafos bien desarrollados. 
      Al final de la sección, añade el enlace de búsqueda de imágenes de Google para el principio físico o teoría general).
      
      ---

      ## ⚙️ 2. ARQUITECTURA, COMPONENTES Y ESPECIFICACIONES TÉCNICAS
      (Desglose minucioso pieza por pieza. Crea una TABLA EXHAUSTIVA de componentes técnicos, materiales de fabricación, rangos operativos, tolerancias y vida útil esperada. 
      Explica cada componente de la tabla en texto abajo. Al final, añade el enlace de búsqueda de Google Imágenes para los componentes).

      ---

      ## 📐 3. MODELAMIENTO MATEMÁTICO, FÓRMULAS Y NORMATIVAS
      (Muestra las fórmulas matemáticas o leyes que rigen este tema. Explica detalladamente qué significa cada variable de la fórmula. Detalla las normativas internacionales o chilenas asociadas, ej. ISO, SEC, IEEE, DIN. Usa bloques de código \`\`\` para destacar fórmulas).

      ---

      ## ⚠️ 4. DIAGNÓSTICO AVANZADO Y ANÁLISIS DE FALLAS (TROUBLESHOOTING)
      (Análisis profundo de los problemas en la vida real. ¿Por qué falla este sistema/concepto? Explica los modos de falla, causas raíz, efectos en la línea de producción y soluciones teóricas avanzadas).

      ---

      ## 🧠 5. EVALUACIÓN TAXONÓMICA: NIVELES SUPERIORES DE BLOOM
      (Redacta 5 preguntas o casos de estudio de altísima complejidad técnica, abarcando [Análisis], [Síntesis] y [Evaluación]. El estudiante debe resolver problemas, evaluar gráficos teóricos o justificar decisiones técnicas críticas basándose en los puntos anteriores).
    `;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptEstructurado, tipo: "guia" }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      let rawContent = data.guia || data.choices?.[0]?.message?.content || "";
      const cleanMarkdown = rawContent.replace(/^```markdown\n?/gi, "").replace(/^```\n?/gi, "").replace(/```$/gi, "").trim();
      
      if (cleanMarkdown) {
        setGuiaGenerada(cleanMarkdown);
      } else {
        throw new Error("La IA no devolvió contenido válido.");
      }

    } catch (error) {
      console.error("Error:", error);
      setGuiaGenerada("# ❌ Error de Conexión\nNo se pudo obtener el documento. Revisa la consola o tu conexión.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading || cargandoDatos) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black text-slate-900 uppercase tracking-tighter">Sincronizando Currículum...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans text-slate-900 pb-20 print:bg-white print:pb-0">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8 print:p-0 print:gap-0 print:block">
        
        {/* PANEL DE CONFIGURACIÓN */}
        <aside className="xl:col-span-4 space-y-6 no-print">
          
          <button 
            onClick={() => router.push("/dashboard")} 
            className="group flex items-center gap-3 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-all mb-2"
          >
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-200 group-hover:border-slate-400 group-hover:-translate-x-1 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </div>
            Volver al Inicio
          </button>

          <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-8">
            <h2 className="text-2xl font-black uppercase italic mb-8 border-l-4 border-indigo-600 pl-4 text-slate-800">Códice Técnico IA</h2>

            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Módulo Asignado</label>
                <select 
                  value={formData.modulo}
                  onChange={(e) => setFormData({...formData, modulo: e.target.value, ae: "", ce: ""})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-2xl font-bold text-sm transition-all outline-none text-slate-700"
                >
                  <option value="">Selecciona un módulo...</option>
                  {modulosDisponibles.map((m, i) => <option key={i} value={m.nombre}>{m.nombre}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Aprendizaje Esperado (AE)</label>
                <select 
                  disabled={!formData.modulo}
                  value={formData.ae}
                  onChange={(e) => setFormData({...formData, ae: e.target.value, ce: ""})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-2xl font-bold text-sm transition-all outline-none disabled:opacity-40 text-slate-700"
                >
                  <option value="">Selecciona AE...</option>
                  {aprendizajesFiltrados.map((ae, i) => <option key={i} value={ae.textoAE}>{ae.textoAE}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Tema Teórico Extenso</label>
                <textarea 
                  value={formData.contenido}
                  onChange={(e) => setFormData({...formData, contenido: e.target.value})}
                  placeholder="Ej: Análisis termodinámico de motores, Arquitectura de redes TCP/IP, Leyes de Kirchhoff y análisis de circuitos..."
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-2xl font-bold text-sm h-32 resize-none transition-all outline-none text-slate-700"
                />
              </div>

              <button 
                onClick={generarGuia}
                disabled={isGenerating || !formData.contenido}
                className={`w-full font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-lg ${isGenerating ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-slate-200' : 'bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-indigo-600/30 active:scale-95'}`}
              >
                {isGenerating ? (
                   <span className="flex items-center gap-3">
                     <div className="w-5 h-5 border-4 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                     COMPILANDO MANUAL...
                   </span>
                ) : "📖 GENERAR MANUAL DE INGENIERÍA"}
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
              
              {guiaGenerada && (
                <div className="flex gap-3 items-center">
                  <button 
                    onClick={() => { navigator.clipboard.writeText(guiaGenerada); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
                    className="px-5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    {copiado ? "¡COPIADO!" : "COPIAR MD"}
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                    IMPRIMIR PDF
                  </button>
                </div>
              )}
            </div>

            <div className="p-10 md:p-16 lg:p-20 flex-grow bg-white print:p-0 overflow-y-auto">
              {guiaGenerada ? (
                <article className={`prose prose-slate max-w-none 
                  prose-h1:text-4xl prose-h1:font-black prose-h1:tracking-tighter prose-h1:uppercase prose-h1:mb-12
                  prose-h2:text-xl prose-h2:font-black prose-h2:bg-slate-900 prose-h2:text-white prose-h2:p-3 prose-h2:rounded-lg prose-h2:mt-12
                  prose-h3:text-lg prose-h3:font-bold prose-h3:text-slate-800 prose-h3:border-b-2 prose-h3:border-slate-100 prose-h3:pb-2 prose-h3:mt-8
                  prose-table:w-full prose-table:border-2 prose-table:border-slate-200 prose-table:rounded-xl prose-table:overflow-hidden prose-table:my-8
                  prose-th:bg-slate-100 prose-th:p-4 prose-th:text-left prose-th:uppercase prose-th:text-[11px] prose-th:tracking-wider prose-th:text-slate-500
                  prose-td:p-4 prose-td:border-b prose-td:border-slate-100
                  prose-hr:border-t-2 prose-hr:border-dashed prose-hr:border-slate-200 prose-hr:my-12
                  prose-a:text-indigo-600 prose-a:font-bold prose-a:no-underline hover:prose-a:text-indigo-800 hover:prose-a:underline
                  prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50/50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-indigo-900 prose-blockquote:font-medium
                  prose-pre:bg-slate-900 prose-pre:border-2 prose-pre:border-slate-700 prose-pre:shadow-xl
                  prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded
                  prose-li:marker:text-indigo-600
                  print:prose-h2:bg-slate-100 print:prose-h2:text-black print:prose-h2:border-l-4 print:prose-h2:border-black print:prose-h2:rounded-none
                  print:prose-hr:border-slate-300
                  print:prose-a:text-black print:prose-a:underline
                `}>
                  
                  {/* ENCABEZADO INSTITUCIONAL ENCICLOPÉDICO */}
                  <header className="border-[6px] border-slate-900 p-8 mb-16 relative overflow-hidden rounded-2xl print:border-[4px] print:rounded-none">
                    <div className="absolute top-0 right-0 px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl print:border-l-[4px] print:border-b-[4px] print:border-black print:bg-white print:text-black">
                      Tratado Técnico
                    </div>
                    <div className="flex flex-col gap-2 mb-8">
                       <h4 className="text-[12px] font-black text-indigo-600 uppercase tracking-[0.2em]">{formData.modulo || "Módulo Técnico"}</h4>
                       <h1 className="text-3xl font-black m-0 leading-tight tracking-tighter uppercase text-slate-900">MANUAL DE INGENIERÍA Y FUNDAMENTOS</h1>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-2 border-slate-100 pt-8 print:border-black/20">
                      <div className="space-y-5">
                        <div className="border-b-2 border-slate-100 pb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Códice asignado a:</span>
                          <div className="h-6"></div>
                        </div>
                        <div className="border-b-2 border-slate-100 pb-2 flex justify-between items-end">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Autor / Docente</span>
                          <span className="text-sm font-bold text-slate-800">{profile?.nombre || "Docente EMTP"}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="border-b-2 border-slate-100 pb-2 flex flex-col justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Edición</span>
                          <span className="text-sm font-bold text-slate-800 text-right">{new Date().toLocaleDateString()}</span>
                        </div>
                        <div className="bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center rounded-xl p-4 print:border-black print:border-solid">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nivel</span>
                          <span className="text-xl font-black text-slate-400">AVANZADO</span>
                        </div>
                      </div>
                    </div>
                  </header>

                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{guiaGenerada}</ReactMarkdown>
                </article>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-40">
                  <div className="w-28 h-28 mb-8 border-4 border-dashed border-slate-200 rounded-full flex items-center justify-center bg-slate-50 text-slate-300">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 mb-2">Tratado Enciclopédico</h3>
                  <p className="max-w-md mx-auto text-sm font-medium text-slate-500 leading-relaxed">Configura la temática para que la IA desarrolle un manual masivo con enlaces de imágenes dinámicas, fórmulas teóricas y separaciones limpias.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        /* Configuración específica para imprimir en tamaño Carta / A4 perfecto */
        @media print {
          @page { margin: 1.5cm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          aside, button, .no-print { display: none !important; }
          main { width: 100% !important; max-width: 100% !important; display: block !important; margin: 0 !important; }
          .bg-\\[\\#f1f5f9\\] { background: white !important; }
          article { font-size: 11pt; line-height: 1.5; }
          
          /* Evita que los títulos y tablas se corten entre páginas */
          h1, h2, h3, h4, h5 { page-break-after: avoid; }
          table, img, pre, blockquote, hr { page-break-inside: avoid; }
          ul, ol { page-break-inside: auto; }
          li { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}