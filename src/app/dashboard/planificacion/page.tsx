"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

export default function PlanificadorElectrónicaV3() {
  const { profile, loading: authLoading } = useAuth();
  const [loadingMalla, setLoadingMalla] = useState(true);
  const [generandoIA, setGenerandoIA] = useState(false);
  const [mallaCompleta, setMallaCompleta] = useState<any>(null);
  const [openStep, setOpenStep] = useState<number>(1);
  const [historial, setHistorial] = useState<any[]>([]);

  // 1. ESTADO MAESTRO
  const [plan, setPlan] = useState({
    nombreClase: "",
    modulo: "",
    aprendizajeEsperado: null as any,
    criteriosSeleccionados: [] as any[],
    contenidoEspecífico: "",
    horas: "2",
    fecha: new Date().toLocaleDateString(),
    tipoClase: "Práctica",
    neeSeleccionadas: [] as string[],
    
    pilares: { objetivos: "", contenidos: "", estandares: "" },
    inicio: { docente: "", estudiante: "" },
    desarrollo: { docente: "", estudiante: "", actividad: "" },
    cierre: { docente: "", estudiante: "" },
    recursos: { tecnologia: "", materialFisico: "", fuentes: "", epp: "" },
    charlaSeguridad: "", 
    dua: "",
    rubrica: [] as { aspecto: string; logrado: string; porLograr: string; noLogrado: string }[]
  });

  const opcionesHoras = ["1", "2", "3", "4", "5", "6", "8"];
  const tiposDeClase = ["Teórica", "Práctica", "Híbrida"];
  const opcionesNEE = [
    "TDAH (Atención)", "TEA (Espectro Autista)", "DEA (Dificultad Aprendizaje)", 
    "FIL (Func. Intelectual)", "Dificultad Visual", "Dificultad Auditiva", "Discapacidad Motora"
  ];

  // ==========================================
  // CARGA DE DATOS DESDE FIREBASE
  // ==========================================
  useEffect(() => {
    if (profile && profile.modulosAsignados && profile.modulosAsignados.length > 0) {
      const unsubscribe = onSnapshot(collection(db, "curriculum"), (snapshot) => {
        let modulosEncontrados: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const arrayDeModulos = data.malla || data.modulos || data.unidades || [];
          if (Array.isArray(arrayDeModulos)) {
            arrayDeModulos.forEach((mod: any) => {
              if (mod.nombre && profile.modulosAsignados.includes(mod.nombre.trim())) {
                modulosEncontrados.push({ ...mod, origenEspecialidad: data.especialidad || data.asignatura || "General" });
              }
            });
          }
        });
        setMallaCompleta({ malla: modulosEncontrados });
        setLoadingMalla(false);
      }, () => setLoadingMalla(false));
      return () => unsubscribe();
    } else if (profile) {
      setLoadingMalla(false);
    }
  }, [profile]);

  useEffect(() => {
    const saved = localStorage.getItem("historial_planes");
    if (saved) setHistorial(JSON.parse(saved));
  }, []);

  const modulosDocente = mallaCompleta?.malla || [];
  const moduloActual = modulosDocente.find((m: any) => m.nombre === plan.modulo);
  const aprendizajesDisponibles = moduloActual?.aprendizajes || [];

  const toggleNEE = (nee: string) => {
    setPlan(prev => ({
      ...prev,
      neeSeleccionadas: prev.neeSeleccionadas.includes(nee)
        ? prev.neeSeleccionadas.filter(n => n !== nee)
        : [...prev.neeSeleccionadas, nee]
    }));
  };
// ==========================================
  // MOTOR DE IA BLINDADO (NEE Específicas y Rúbrica Forzada 4 filas)
  // ==========================================
  const generarPlanificacionIA = async () => {
    if (!profile || !plan.aprendizajeEsperado || !plan.contenidoEspecífico) return;
    setGenerandoIA(true);

    const contextoModalidad = 
      plan.tipoClase === "Teórica" 
        ? "Enfoque: CLASE MAGISTRAL O EXPOSITIVA. Céntrate en análisis de conceptos, debates, y asimilación teórica."
        : plan.tipoClase === "Práctica"
        ? "Enfoque: CLASE DE TALLER ('METER MANOS'). El estudiante usa herramientas, equipos, ensambla, o mide físicamente."
        : "Enfoque: CLASE HÍBRIDA. Inicia teórica magistral y transita al trabajo práctico de taller.";

    const contextoNEE = plan.neeSeleccionadas.length > 0 
      ? `ESTUDIANTES CON NEE EN EL AULA: ${plan.neeSeleccionadas.join(", ")}. REGLA DE ORO: Por CADA UNO de estos diagnósticos, escribe su nombre explícitamente y da 2 estrategias DUA exactas para aplicar en la actividad.` 
      : "Diagnósticos NEE: Ninguno específico. Aplica principios DUA generales de accesibilidad.";

    // NUEVO: Capturamos la especialidad dinámica que viene de Firebase
    const especialidadActual = moduloActual?.origenEspecialidad || "Técnico Profesional";

    // PROMPT MODIFICADO: Ahora es dinámico e incluye el Aprendizaje Esperado
    const promptMaster = `
      Actúa como experto pedagogo EMTP de la especialidad de ${especialidadActual.toUpperCase()}.
      
      CONTEXTO TÉCNICO:
      Especialidad: ${especialidadActual}
      Módulo: ${plan.modulo}
      Aprendizaje Esperado: ${plan.aprendizajeEsperado.textoAE}
      Criterios de Evaluación Seleccionados: ${plan.criteriosSeleccionados.map((c: any) => c.textoCE).join(" | ")}
      CONTENIDOS A ENSEÑAR: ${plan.contenidoEspecífico}
      
      MODALIDAD Y NEE:
      - ${contextoModalidad}
      - ${contextoNEE}

      ESTRUCTURA Y REGLAS ESTRICTAS (¡CUMPLE TODAS!):
      1. FOCO ABSOLUTO EN LOS CONTENIDOS: Toda la clase (el inicio, la actividad de desarrollo, la evaluación y el cierre) debe estar diseñada y girar 100% en torno a enseñar los "CONTENIDOS A ENSEÑAR" y lograr el "Aprendizaje Esperado" indicado.
      2. PILARES Y MBE: Define Objetivos medibles, Contenidos y Estándares EMTP. Aplica el Marco de la Buena Enseñanza.
      3. INICIO, DESARROLLO Y CIERRE:
         - ¡PROHIBIDO DUPLICAR CONTENIDO! Docente y Estudiante tienen roles DISTINTOS.
         - El Docente: Enseña, explica, modela, monitorea, guía, retroalimenta.
         - El Estudiante: Escucha,aprende, analiza, arma, mide, anota, responde.
         - Escribe EXACTAMENTE 6 A 9 viñetas distintas para cada rol.
      4. ESTRATEGIAS NEE/DUA: Nombra el diagnóstico seleccionado (Ej: "Para TDAH: ...") y da los tips. Si hay 2 diagnósticos, sepáralos claramente.
      5. RÚBRICA: DEBES CREAR EXACTAMENTE 4 CRITERIOS A EVALUAR (Filas) basados en los Criterios de Evaluación Seleccionados. Ni 2, ni 3. Tienen que ser 4 aspectos técnicos distintos con sus 4 niveles de logro (Logrado, Por Lograr, No Logrado).

      Devuelve ÚNICAMENTE un objeto JSON puro. NO incluyas formato markdown. Copia esta ESTRUCTURA EXACTA:
      {
        "nombreClase": "Título técnico de la clase",
        "pilares": { "objetivos": "Objetivo medible...", "contenidos": "Contenido...", "estandares": "Estándar..." },
        "charlaSeguridad": "Consejo técnico de seguridad...",
        "inicio": { 
          "docente": "• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...", 
          "estudiante": "• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ..." 
        },
        "desarrollo": { 
          "actividad": "Descripción clara...", 
          "docente": "• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...", 
          "estudiante": "• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ..." 
        },
        "cierre": { 
          "docente": "• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...", 
          "estudiante": "• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ...\\n• ..." 
        },
        "recursos": { "tecnologia": "...", "materialFisico": "...", "fuentes": "...", "epp": "..." },
        "dua": "• [Nombre Diagnóstico 1]: Tip 1...\\n• [Nombre Diagnóstico 1]: Tip 2...\\n• [Nombre Diagnóstico 2]: Tip 1...",
        "rubrica": [ 
          {"aspecto": "Criterio 1", "logrado": "...", "porLograr": "...", "noLogrado": "..."},
          {"aspecto": "Criterio 2", "logrado": "...", "porLograr": "...", "noLogrado": "..."},
          {"aspecto": "Criterio 3", "logrado": "...", "porLograr": "...", "noLogrado": "..."},
          {"aspecto": "Criterio 4", "logrado": "...", "porLograr": "...", "noLogrado": "..."}
        ]
      }
    `;

    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptMaster }),
      });
      const data = await res.json();

      const sanitizeText = (val: any) => {
        if (!val) return "";
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return val.join("\n• ");
        if (typeof val === 'object') return Object.values(val).join(" - ");
        return String(val);
      };

      if (data.pilares) {
        data.pilares.objetivos = sanitizeText(data.pilares.objetivos);
        data.pilares.contenidos = sanitizeText(data.pilares.contenidos);
        data.pilares.estandares = sanitizeText(data.pilares.estandares);
      }
      if (data.inicio) {
        data.inicio.docente = sanitizeText(data.inicio.docente);
        data.inicio.estudiante = sanitizeText(data.inicio.estudiante);
      }
      if (data.desarrollo) {
        data.desarrollo.docente = sanitizeText(data.desarrollo.docente);
        data.desarrollo.estudiante = sanitizeText(data.desarrollo.estudiante);
        data.desarrollo.actividad = sanitizeText(data.desarrollo.actividad);
      }
      if (data.cierre) {
        data.cierre.docente = sanitizeText(data.cierre.docente);
        data.cierre.estudiante = sanitizeText(data.cierre.estudiante);
      }
      if (data.recursos) {
        data.recursos.tecnologia = sanitizeText(data.recursos.tecnologia);
        data.recursos.materialFisico = sanitizeText(data.recursos.materialFisico);
        data.recursos.fuentes = sanitizeText(data.recursos.fuentes);
        data.recursos.epp = sanitizeText(data.recursos.epp);
      }
      
      if (data.dua) {
        data.dua = sanitizeText(data.dua);
      }

      const nuevoPlan = { ...plan, ...data };
      setPlan(nuevoPlan);
      
      const nuevoHistorial = [nuevoPlan, ...historial].slice(0, 10);
      setHistorial(nuevoHistorial);
      localStorage.setItem("historial_planes", JSON.stringify(nuevoHistorial));
      setOpenStep(3); 

    } catch (e) {
      alert("⚠️ Hubo un error de formato con la IA. Por favor, intenta generar nuevamente.");
      console.error(e);
    } finally {
      setGenerandoIA(false);
    }
  };

  // ==========================================
  // EXPORTACIÓN A PDF Y WORD
  // ==========================================
  const descargarPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text(`PLANIFICACIÓN: ${plan.nombreClase}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Módulo: ${plan.modulo} | Modalidad: ${plan.tipoClase}`, 14, 22);
    doc.text(`Diagnósticos NEE: ${plan.neeSeleccionadas.length > 0 ? plan.neeSeleccionadas.join(", ") : "Ninguno específico"}`, 14, 27);
    
    autoTable(doc, {
      startY: 32,
      head: [['Objetivos de Aprendizaje', 'Contenidos', 'Estándares / Competencias']],
      body: [[plan.pilares?.objetivos || "", plan.pilares?.contenidos || "", plan.pilares?.estandares || ""]],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [52, 73, 94] }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Momento', 'Acción Docente', 'Acción Estudiante']],
      body: [
        ['INICIO (Gancho)', plan.inicio?.docente || "", plan.inicio?.estudiante || ""],
        ['DESARROLLO (Corazón)', `Actividad: ${plan.desarrollo?.actividad || ""}\n\n${plan.desarrollo?.docente || ""}`, plan.desarrollo?.estudiante || ""],
        ['CIERRE (Consolidación)', plan.cierre?.docente || "", plan.cierre?.estudiante || ""]
      ],
      styles: { fontSize: 8, cellPadding: 3 }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Tecnología', 'Material Físico', 'Fuentes', 'Seguridad (EPP)']],
      body: [[plan.recursos?.tecnologia || "-", plan.recursos?.materialFisico || "-", plan.recursos?.fuentes || "-", plan.recursos?.epp || "-"]],
      headStyles: { fillColor: [41, 128, 185] }
    });

    if(plan.rubrica && plan.rubrica.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text("RÚBRICA DE EVALUACIÓN TÉCNICA", 14, 15);
        autoTable(doc, {
            startY: 25,
            head: [['Aspecto', 'Logrado (3)', 'Por Lograr (2)', 'No Logrado (1)']],
            body: plan.rubrica.map(r => [r.aspecto, r.logrado, r.porLograr, r.noLogrado]),
            headStyles: { fillColor: [39, 174, 96] },
            styles: { fontSize: 8 }
        });
    }
    doc.save(`Plan_${plan.modulo}.pdf`);
  };

  const descargarDOCX = async () => {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: plan.nombreClase || "Planificación", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Módulo: ${plan.modulo} | Horas: ${plan.horas} | Modalidad: ${plan.tipoClase}` }),
          new Paragraph({ text: `Diagnósticos NEE: ${plan.neeSeleccionadas.length > 0 ? plan.neeSeleccionadas.join(", ") : "Ninguno específico"}`, spacing: { after: 200 } }),
          
          new Paragraph({ text: "1. PILARES FUNDAMENTALES", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun({ text: "Objetivos de Aprendizaje:", bold: true })] }),
          new Paragraph({ text: plan.pilares?.objetivos || "-" }),
          new Paragraph({ children: [new TextRun({ text: "Contenidos:", bold: true })] }),
          new Paragraph({ text: plan.pilares?.contenidos || "-" }),
          new Paragraph({ children: [new TextRun({ text: "Estándares / Competencias:", bold: true })] }),
          new Paragraph({ text: plan.pilares?.estandares || "-", spacing: { after: 200 } }),

          new Paragraph({ text: "2. SEGURIDAD Y RECURSOS", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun({ text: "Charla de Seguridad (5 Min):", bold: true })] }),
          new Paragraph({ text: plan.charlaSeguridad || "-", spacing: { after: 100 } }),
          new Paragraph({ text: `• Tecnología: ${plan.recursos?.tecnologia || "-"}` }),
          new Paragraph({ text: `• Material Físico: ${plan.recursos?.materialFisico || "-"}` }),
          new Paragraph({ text: `• Fuentes: ${plan.recursos?.fuentes || "-"}` }),
          new Paragraph({ text: `• EPP: ${plan.recursos?.epp || "-"}`, spacing: { after: 200 } }),
          
          new Paragraph({ children: [new TextRun({ text: "Estrategia DUA / NEE:", bold: true })] }),
          new Paragraph({ text: plan.dua || "No aplica", spacing: { after: 300 } }),

          new Paragraph({ text: "3. MOMENTOS DE LA CLASE", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 200 } }),
          
          new Paragraph({ text: "INICIO (El Gancho)", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: `Docente:\n${plan.inicio?.docente || "-"}` }),
          new Paragraph({ text: `Estudiante:\n${plan.inicio?.estudiante || "-"}`, spacing: { after: 200 } }),
          
          new Paragraph({ text: "DESARROLLO (El Corazón)", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ children: [new TextRun({ text: `Actividad: ${plan.desarrollo?.actividad || "-"}`, italics: true })] }),
          new Paragraph({ text: `Docente:\n${plan.desarrollo?.docente || "-"}` }),
          new Paragraph({ text: `Estudiante:\n${plan.desarrollo?.estudiante || "-"}`, spacing: { after: 200 } }),
          
          new Paragraph({ text: "CIERRE (La Consolidación)", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: `Docente:\n${plan.cierre?.docente || "-"}` }),
          new Paragraph({ text: `Estudiante:\n${plan.cierre?.estudiante || "-"}`, spacing: { after: 400 } }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Plan_${plan.modulo}.docx`);
  };

  if (authLoading || loadingMalla) return <Loader />;

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 lg:p-10 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabecera Principal */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-[2rem] p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-3">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase inline-block">
                Diseño Curricular
              </span>
              <h1 className="text-3xl lg:text-5xl font-black tracking-tight leading-tight">
                Generador de<br/><span className="text-blue-400">Prácticas de Taller</span>
              </h1>
            </div>
            {plan.nombreClase && (
              <div className="flex gap-3 w-full md:w-auto">
                <button onClick={descargarPDF} className="flex-1 md:flex-none bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/30 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-center">
                  PDF
                </button>
                <button onClick={descargarDOCX} className="flex-1 md:flex-none bg-blue-500 hover:bg-blue-400 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all text-center">
                  Word
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* PANEL IZQUIERDO: FORMULARIO WIZARD */}
          <div className="xl:col-span-4 space-y-4">
            
            <AccordionItem num={1} title="Contexto Curricular" isOpen={openStep === 1} onToggle={() => setOpenStep(1)} completed={!!plan.contenidoEspecífico}>
              <div className="space-y-5">
                <Step title="Módulo">
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={plan.modulo} 
                    onChange={(e) => setPlan({...plan, modulo: e.target.value, aprendizajeEsperado: null, criteriosSeleccionados: []})}
                  >
                    <option value="">Selecciona un módulo...</option>
                    {modulosDocente.map((m: any, i: number) => <option key={i} value={m.nombre}>{m.nombre}</option>)}
                  </select>
                </Step>

                {plan.modulo && (
                  <Step title="Aprendizaje Esperado">
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={plan.aprendizajeEsperado?.textoAE || ""}
                      onChange={(e) => {
                        const ae = aprendizajesDisponibles.find((a: any) => a.textoAE === e.target.value);
                        setPlan({...plan, aprendizajeEsperado: ae, criteriosSeleccionados: []});
                      }}
                    >
                      <option value="">Selecciona el AE...</option>
                      {aprendizajesDisponibles.map((ae: any, i: number) => (
                        <option key={i} value={ae.textoAE}>{ae.textoAE}</option>
                      ))}
                    </select>
                  </Step>
                )}

                {plan.aprendizajeEsperado && (
                  <Step title="Criterios de Evaluación (Múltiple)">
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {plan.aprendizajeEsperado.criterios.map((criterio: any, i: number) => {
                        const isSelected = plan.criteriosSeleccionados.some(c => c.textoCE === criterio.textoCE);
                        return (
                          <div 
                            key={i} 
                            onClick={() => {
                              const nuevos = isSelected 
                                ? plan.criteriosSeleccionados.filter(c => c.textoCE !== criterio.textoCE)
                                : [...plan.criteriosSeleccionados, criterio];
                              setPlan({...plan, criteriosSeleccionados: nuevos});
                            }}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex gap-3 ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                          >
                            <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'}`}>
                              {isSelected && '✓'}
                            </div>
                            <span className={`leading-relaxed ${isSelected ? 'text-blue-900 font-bold' : 'text-slate-600 font-medium'}`}>{criterio.textoCE}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Step>
                )}

                <Step title="Contenidos a Tratar en la Clase">
                  <textarea 
                    placeholder="Ej: Ley de Ohm, cálculo de resistencias en serie y paralelo, uso correcto del multímetro..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all h-24 resize-none"
                    value={plan.contenidoEspecífico}
                    onChange={(e) => setPlan({...plan, contenidoEspecífico: e.target.value})}
                  />
                </Step> 

                <button 
                  disabled={!plan.contenidoEspecífico}
                  onClick={() => setOpenStep(2)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl text-xs font-black tracking-widest uppercase transition-all disabled:opacity-50"
                >
                  Continuar a Configuración
                </button>
              </div>
            </AccordionItem>

            <AccordionItem num={2} title="Ajustes de Sesión" isOpen={openStep === 2} onToggle={() => setOpenStep(2)} disabled={!plan.contenidoEspecífico} completed={false}>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Step title="Horas Pedagógicas">
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={plan.horas} onChange={(e) => setPlan({...plan, horas: e.target.value})}
                    >
                      {opcionesHoras.map(h => <option key={h} value={h}>{h} Horas</option>)}
                    </select>
                  </Step>
                  <Step title="Modalidad de Clase">
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={plan.tipoClase} onChange={(e) => setPlan({...plan, tipoClase: e.target.value})}
                    >
                      {tiposDeClase.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Step>
                </div>

                <Step title="Diagnósticos NEE en el Aula (Opcional)">
                  <div className="flex flex-wrap gap-2">
                    {opcionesNEE.map(nee => {
                      const isActive = plan.neeSeleccionadas.includes(nee);
                      return (
                        <button
                          key={nee}
                          onClick={() => toggleNEE(nee)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${isActive ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-orange-300'}`}
                        >
                          {isActive && '✓ '} {nee}
                        </button>
                      );
                    })}
                  </div>
                </Step>

                <button 
                  onClick={generarPlanificacionIA} 
                  disabled={generandoIA}
                  className="w-full relative group overflow-hidden bg-blue-600 text-white py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all shadow-xl shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center justify-center gap-2">
                    {generandoIA ? (
                      <><span className="animate-spin text-lg">⚙️</span> Procesando Modalidad...</>
                    ) : (
                      <>✨ Generar Planificación</>
                    )}
                  </span>
                </button>
              </div>
            </AccordionItem>
          </div>

          {/* PANEL DERECHO: RESULTADOS */}
          <div className="xl:col-span-8">
            {plan.nombreClase ? (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <span className="text-9xl font-black">EMTP</span>
                  </div>
                  
                  <div className="relative z-10">
                    <h2 className="text-2xl font-black text-slate-800 mb-2 leading-tight pr-10">{plan.nombreClase}</h2>
                    <p className="text-slate-500 font-medium text-sm max-w-2xl">{plan.contenidoEspecífico}</p>
                    
                    <div className="flex flex-wrap gap-2 mt-6">
                      <Tag icon="⏱️" text={`${plan.horas} Horas`} />
                      <Tag icon="📚" text={plan.tipoClase} color={plan.tipoClase === 'Teórica' ? 'slate' : plan.tipoClase === 'Práctica' ? 'blue' : 'purple'} />
                      {plan.neeSeleccionadas.map(nee => (
                        <Tag key={nee} icon="🧩" text={nee} color="orange" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* PILARES FUNDAMENTALES */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
                  <h3 className="text-slate-800 font-black text-sm uppercase tracking-widest mb-4 border-b border-slate-100 pb-3">
                    1. Pilares Fundamentales
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Objetivos de Aprendizaje</h4>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{plan.pilares?.objetivos || "No especificado"}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Contenidos</h4>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{plan.pilares?.contenidos || "No especificado"}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Estándares / Competencias</h4>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{plan.pilares?.estandares || "No especificado"}</p>
                    </div>
                  </div>
                </div>

                {/* ESTRUCTURA PEDAGÓGICA (MOMENTOS) */}
                <div className="space-y-4">
                  <MomentSection title="Inicio (El Gancho)" duration="15%">
                    <RoleCard role="Docente" text={plan.inicio?.docente} icon="👨‍🏫" />
                    <RoleCard role="Estudiante" text={plan.inicio?.estudiante} icon="🧑‍🎓" />
                  </MomentSection>

                  <MomentSection title="Desarrollo (El Corazón)" duration="70%" color="blue">
                    {plan.desarrollo?.actividad && (
                      <div className="col-span-1 md:col-span-2 bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50 mb-2">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-2">
                          {plan.tipoClase === 'Teórica' ? 'Foco de Análisis Teórico' : 'Actividad Práctica de Taller'}
                        </span>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">{plan.desarrollo.actividad}</p>
                      </div>
                    )}
                    <RoleCard role="Docente" text={plan.desarrollo?.docente} icon="👨‍🏫" bg="bg-white" />
                    <RoleCard role="Estudiante" text={plan.desarrollo?.estudiante} icon="🧑‍🎓" bg="bg-white" />
                  </MomentSection>

                  <MomentSection title="Cierre (La Consolidación)" duration="15%">
                    <RoleCard role="Docente" text={plan.cierre?.docente} icon="👨‍🏫" />
                    <RoleCard role="Estudiante" text={plan.cierre?.estudiante} icon="🧑‍🎓" />
                  </MomentSection>
                </div>

                <div className="space-y-5 mt-8">
                  <h3 className="text-blue-600 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3">
                    <span className="w-8 h-[2px] bg-blue-500"></span> Recursos Necesarios
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
                      <ResourceItem title="Tecnología" text={plan.recursos?.tecnologia} icon="💻" color="blue" />
                      <ResourceItem title="Material Físico" text={plan.recursos?.materialFisico} icon="📚" color="slate" />
                      <ResourceItem title="Fuentes de Consulta" text={plan.recursos?.fuentes} icon="🌐" color="purple" />
                      <ResourceItem title="Seguridad (EPP)" text={plan.recursos?.epp} icon="🥽" color="orange" />
                  </div>
                </div>

                {plan.dua && plan.dua.length > 10 && (
                  <div className="bg-orange-50 p-6 rounded-3xl border border-orange-200 mt-6 flex gap-5 items-start">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-orange-100 flex-shrink-0">
                      🧩
                    </div>
                    <div>
                      <h4 className="text-orange-800 font-black text-xs uppercase tracking-widest mb-2">Estrategias DUA / NEE</h4>
                      <p className="text-sm text-orange-900/80 font-medium leading-relaxed">{plan.dua}</p>
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 mt-6 flex gap-5 items-start">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-amber-100 flex-shrink-0">
                    ⚠️
                  </div>
                  <div>
                    <h4 className="text-amber-800 font-black text-xs uppercase tracking-widest mb-2">Charla de Seguridad (5 Min)</h4>
                    <p className="text-sm text-amber-900/80 font-medium leading-relaxed">{plan.charlaSeguridad}</p>
                  </div>
                </div>

                {plan.rubrica && plan.rubrica.length > 0 && (
                  <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden mt-8">
                    <div className="bg-slate-50 p-6 border-b border-slate-200">
                      <h3 className="text-slate-800 font-black text-sm uppercase tracking-widest">Rúbrica de Evaluación</h3>
                    </div>
                    <div className="p-0 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500">
                          <tr>
                            <th className="p-5 font-black">Aspecto a Evaluar</th>
                            <th className="p-5 font-black text-emerald-600">Logrado (3pts)</th>
                            <th className="p-5 font-black text-amber-600">Por Lograr (2pts)</th>
                            <th className="p-5 font-black text-red-600">No Logrado (1pt)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {plan.rubrica.map((rub: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-5 font-bold text-slate-800 w-1/4">{rub.aspecto}</td>
                              <td className="p-5 text-slate-600 leading-relaxed w-1/4">{rub.logrado}</td>
                              <td className="p-5 text-slate-600 leading-relaxed w-1/4">{rub.porLograr}</td>
                              <td className="p-5 text-slate-600 leading-relaxed w-1/4">{rub.noLogrado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
              </div>
            ) : (
              <div className="h-full min-h-[600px] border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-center p-10 bg-white/50">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-6 opacity-50">🤖</div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Panel de Resultados IA</h3>
                <p className="text-sm font-medium text-slate-500 max-w-sm">
                  Configura los parámetros, elige tu modalidad y selecciona diagnósticos NEE (si aplica) para generar una pauta personalizada.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTES UI AUXILIARES (CON PROTECCIÓN ADICIONAL)
// ==========================================

function AccordionItem({ num, title, isOpen, onToggle, children, completed, disabled }: any) {
  return (
    <div className={`rounded-3xl border overflow-hidden transition-all duration-300 ${isOpen ? 'ring-4 ring-blue-50 border-blue-200 bg-white scale-[1.02]' : 'border-slate-100'} ${disabled ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
      <button onClick={onToggle} className={`w-full flex items-center justify-between p-6 text-left ${isOpen ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}>
        <div className="flex items-center gap-4">
          <span className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-black ${completed ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>{completed ? '✓' : num}</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-800">{title}</span>
        </div>
        <span className="text-slate-300 text-2xl">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && <div className="p-8 bg-white border-t border-slate-50 animate-in slide-in-from-top-4">{children}</div>}
    </div>
  );
}

function Step({ title, children }: any) {
  return (
    <div className="space-y-3">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">{title}</label>
      {children}
    </div>
  );
}

function Tag({ icon, text, color = "slate" }: any) {
  const themes: any = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
    orange: "bg-orange-100 text-orange-800 border-orange-200",
  };
  return (
    <span className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${themes[color] || themes.slate}`}>
      <span>{icon}</span> {text}
    </span>
  );
}

function MomentSection({ title, duration, children, color = "slate" }: any) {
  const bg = color === "blue" ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200";
  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${bg}`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h3>
        <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-3 py-1 rounded-full">{duration}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

function RoleCard({ role, text, icon, bg = "bg-slate-50" }: any) {
  if (!text || typeof text !== 'string') return null; 
  const itemsLista = text.split(/,|•|\n/).map((item: string) => item.trim()).filter((item: string) => item.length > 0 && !item.match(/^\d+\.$/));
  return (
    <div className={`p-5 rounded-2xl border border-slate-100 ${bg}`}>
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100/50">
        <span className="text-lg">{icon}</span>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{role}</h4>
      </div>
      <ul className="space-y-2">
        {itemsLista.map((item: string, index: number) => (
          <li key={index} className="flex items-start gap-2 text-xs font-medium text-slate-700 leading-relaxed">
            <span className="mt-[2px] opacity-40 text-blue-500 font-bold">•</span>
            <span className="flex-1">{item.replace(/^\d+\.\s*/, '')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResourceItem({ title, text, icon, color }: any) {
    const themes: any = {
      slate: "bg-slate-50 text-slate-700 border-slate-200",
      blue: "bg-blue-50 text-blue-700 border-blue-200",
      purple: "bg-purple-50 text-purple-700 border-purple-200",
      orange: "bg-orange-50 text-orange-700 border-orange-200",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200"
    };

    const itemsLista = text && typeof text === 'string'
      ? text.split(/,|•|\n/).map((item: string) => item.trim()).filter((item: string) => item.length > 0)
      : [];

    return (
        <div className={`p-6 rounded-3xl border-2 ${themes[color] || themes.slate} flex flex-col h-full shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center gap-3 mb-4 border-b border-black/5 pb-3">
                <span className="text-2xl">{icon}</span>
                <h4 className="text-[11px] font-black uppercase tracking-widest opacity-80">{title}</h4>
            </div>
            <ul className="space-y-2 flex-1">
                {itemsLista.length > 0 ? (
                    itemsLista.map((item: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-[11px] font-bold text-slate-700 leading-snug">
                            <span className="mt-[2px] opacity-40 text-current">•</span>
                            <span className="flex-1 capitalize-first">{item}</span>
                        </li>
                    ))
                ) : (
                    <li className="text-[10px] font-bold opacity-40 italic">No especificado</li>
                )}
            </ul>
        </div>
    );
}

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}