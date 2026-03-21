import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export const generarContenidoPedagogico = async (
  tipo: "planificacion" | "guia" | "apunte",
  datos: { modulo: string; ae: string; criterios: string[] }
) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Actúa como un experto asesor pedagógico de Educación Media Técnico Profesional en Chile.
    Tu objetivo es generar una ${tipo} de alta calidad.
    
    CONTEXTO:
    - Especialidad: Electrónica.
    - Módulo: ${datos.modulo}
    - Aprendizaje Esperado (AE): ${datos.ae}
    - Criterios de Evaluación: ${datos.criterios.join(", ")}
    
    INSTRUCCIONES:
    1. Si es 'planificacion': Estructura Inicio, Desarrollo y Cierre (90 min). Incluye actividades prácticas.
    2. Si es 'guia': Crea una guía de trabajo con una breve introducción teórica y 3 actividades desafiantes basadas en los criterios.
    3. Si es 'apunte': Resume los conceptos técnicos clave y diagramas sugeridos.
    4. Usa un tono profesional, motivador y alineado al Marco de Cualificaciones TP.
    
    Responde en formato Markdown limpio.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error con Gemini:", error);
    return "Lo siento, hubo un error al conectar con la IA.";
  }
};