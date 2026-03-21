"use client";
import Link from "next/link";

export default function CurriculumMenu() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center pb-32">
      <div className="text-center mb-12 space-y-4">
        <h1 className="text-4xl font-black uppercase tracking-tight text-slate-800">
          Carga de <span className="text-blue-600">Currículum</span>
        </h1>
        <p className="text-slate-500 font-medium max-w-lg mx-auto">
          Selecciona el tipo de programa de estudio que deseas procesar. Cada formato tiene su propia estructura e Inteligencia Artificial adaptada.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {/* TARJETA TP */}
        <Link href="/dashboard/admin/curriculum/tp" className="group bg-white p-8 rounded-[3rem] shadow-sm hover:shadow-xl border-2 border-slate-100 hover:border-blue-500 transition-all text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center text-4xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
            🛠️
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase">Formación TP</h2>
            <p className="text-sm text-slate-400 mt-2">Módulos, Aprendizajes Esperados, Criterios y Genéricos.</p>
          </div>
        </Link>

        {/* TARJETA BÁSICA */}
        <Link href="/dashboard/admin/curriculum/basica" className="group bg-white p-8 rounded-[3rem] shadow-sm hover:shadow-xl border-2 border-slate-100 hover:border-emerald-500 transition-all text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all">
            🎒
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase">Educación Básica</h2>
            <p className="text-sm text-slate-400 mt-2">Asignaturas, Unidades, OA e Indicadores (1° a 8° Básico).</p>
          </div>
        </Link>

        {/* TARJETA HC */}
        <Link href="/dashboard/admin/curriculum/hc" className="group bg-white p-8 rounded-[3rem] shadow-sm hover:shadow-xl border-2 border-slate-100 hover:border-purple-500 transition-all text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-[2rem] flex items-center justify-center text-4xl group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all">
            📚
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase">Formación HC</h2>
            <p className="text-sm text-slate-400 mt-2">Asignaturas, Unidades, OA e Indicadores (1° a 4° Medio).</p>
          </div>
        </Link>
      </div>
    </div>
  );
}