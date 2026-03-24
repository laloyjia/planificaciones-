import { NextResponse } from "next/server";
import OpenAI from "openai";

// Forzamos el runtime de Node.js para compatibilidad con pdf-parse-fork y Buffer
export const runtime = 'nodejs';

// 1. CONFIGURACIÓN DE ROTACIÓN (10 Groq + 2 OpenAI)
const API_KEYS = [
  { name: "GROQ_1", key: process.env.GROQ_API_KEY_1, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_2", key: process.env.GROQ_API_KEY_2, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_3", key: process.env.GROQ_API_KEY_3, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_4", key: process.env.GROQ_API_KEY_4, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_5", key: process.env.GROQ_API_KEY_5, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_6", key: process.env.GROQ_API_KEY_6, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_7", key: process.env.GROQ_API_KEY_7, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_8", key: process.env.GROQ_API_KEY_8, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_9", key: process.env.GROQ_API_KEY_9, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "GROQ_10", key: process.env.GROQ_API_KEY_10, base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  { name: "OPENAI_1", key: process.env.OPENAI_API_KEY_1, base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "OPENAI_2", key: process.env.OPENAI_API_KEY_2, base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
].filter(item => item.key); // Solo cargamos las que realmente estén en el .env

// 2. FUNCIÓN DE LLAMADA CON REINTENTO AUTOMÁTICO (Failsafe)
// INCORPORACIÓN: Añadimos 'isJson: boolean = true' para que por defecto siga funcionando igual, pero se pueda desactivar.
async function fetchAIWithRotation(messages: any[], temperature: number, isJson: boolean = true) {
  let lastError: any = null;

  for (const config of API_KEYS) {
    try {
      console.log(`📡 Intentando con API: ${config.name} (Modo JSON: ${isJson})`);
      const client = new OpenAI({ apiKey: config.key, baseURL: config.base });

      const completion = await client.chat.completions.create({
        messages,
        model: config.model,
        // INCORPORACIÓN: Alterna dinámicamente el formato de respuesta
        response_format: isJson ? { type: "json_object" } : { type: "text" },
        temperature,
      });

      console.log(`✅ Éxito con: ${config.name}`);
      return completion.choices[0].message.content;
    } catch (error: any) {
      lastError = error;
      // Si el error es 429 (Límite de tokens/peticiones), saltamos a la siguiente llave
      if (error.status === 429) {
        console.warn(`⚠️ Límite excedido en ${config.name}. Probando con la siguiente llave disponible...`);
        continue;
      }
      // Para otros errores (401, 500), lanzamos el error para depurar
      throw error;
    }
  }
  throw new Error(`Todas las llaves fallaron. Último error: ${lastError?.message}`);
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // ============================================================================
    // LÓGICA 1: PROCESAMIENTO DE DOCUMENTOS (PDF/WORD)
    // ============================================================================
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) return NextResponse.json({ error: "No se subió ningún archivo" }, { status: 400 });

      const pdf = require("pdf-parse-fork");
      let textoExtraido = "";
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const data = await pdf(buffer);
        textoExtraido = data.text;
        console.log("✅ PDF leído. Longitud original:", textoExtraido.length);
      } catch (pdfError: any) {
        return NextResponse.json({ error: "Error al extraer texto del PDF" }, { status: 500 });
      }

      // System Prompt MEJORADO y BLINDADO
      const systemPrompt = `Eres un extractor experto y estrictamente literal de programas curriculares de Educación Media Técnico Profesional (EMTP) en Chile.
      
      REGLAS DE ORO ABSOLUTAS:
      1. ¡TIENES PROHIBIDO RESUMIR U OMITIR INFORMACIÓN! Debes extraer TODOS Y CADA UNO de los Criterios de Evaluación (CE) y Aprendizajes Esperados (AE) exactamente como aparecen en el texto. Si un AE tiene 15 Criterios, debes extraer los 15 obligatoriamente.
      2. Ignora tus conocimientos previos. Cíñete 100% al texto entregado.
      3. Mantén la jerarquía exacta: Especialidad -> Módulos -> OA de Especialidad -> Aprendizajes Esperados -> Criterios de Evaluación -> Objetivos Genéricos (A-L).
      4. Si un dato no existe, deja el campo como un arreglo vacío []. NO INVENTES CONTENIDO.
      
      ESTRUCTURA JSON ESTRICTA REQUERIDA:
      {
        "especialidad": "Nombre detectado",
        "modulos": [
          {
            "nombre": "Nombre del módulo",
            "curso": "3° Medio",
            "oaEspecialidad": ["Texto completo del OA 1", "Texto completo del OA 2"],
            "aprendizajes": [
              {
                "textoAE": "Texto completo del Aprendizaje Esperado",
                "criterios": [
                  { 
                    "textoCE": "Texto completo del Criterio de Evaluación 1", 
                    "genericosAsociados": ["A", "B"] 
                  },
                  { 
                    "textoCE": "Texto completo del Criterio de Evaluación 2", 
                    "genericosAsociados": ["C"] 
                  }
                ]
              }
            ]
          }
        ]
      }`;

      const textoParaIA = textoExtraido.substring(0, 40000);

      const response = await fetchAIWithRotation([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analiza TODO este programa y genera el JSON exhaustivo sin omitir ningún Criterio de Evaluación: ${textoParaIA}` }
      ], 0);

      // MEJORA: Blindaje para asegurar que el JSON del PDF sea parseable
      const cleanPdfJson = (response || "{}").replace(/^```json\n?/gi, "").replace(/^```\n?/gi, "").replace(/```$/gi, "").trim();
      return NextResponse.json(JSON.parse(cleanPdfJson));
    }

    // ============================================================================
    // LÓGICA 2: GENERACIÓN DE PLANIFICACIONES Y GUÍAS (JSON / MARKDOWN)
    // ============================================================================
    if (contentType.includes("application/json")) {
      const { prompt, tipo } = await req.json();
      
      const esGuia = tipo === "guia";

      const systemContent = esGuia
        ? "Eres un experto pedagogo EMTP. Redacta guías técnicas detalladas en formato Markdown puro."
        : "Eres un experto pedagogo EMTP. Generas planificaciones en formato JSON siguiendo estrictamente la estructura solicitada.";

      const response = await fetchAIWithRotation([
        { role: "system", content: systemContent },
        { role: "user", content: prompt }
      ], 0.7, !esGuia);

      if (esGuia) {
        return NextResponse.json({ guia: response });
      } else {
        // MEJORA PRO: Limpiamos los decoradores de código Markdown que a veces Groq añade por error al JSON
        const cleanJsonResponse = (response || "{}").replace(/^```json\n?/gi, "").replace(/^```\n?/gi, "").replace(/```$/gi, "").trim();
        return NextResponse.json(JSON.parse(cleanJsonResponse));
      }
    }

    return NextResponse.json({ error: "Formato de petición no soportado" }, { status: 400 });

  } catch (error: any) {
    console.error("🚨 ERROR GENERAL EN API:", error.message);
    return NextResponse.json({ error: "Error interno: " + error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Motor de Rotación (12 Keys) Activo" });
}