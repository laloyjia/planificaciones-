"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#f8fafc]">
      <div className="max-w-md w-full text-center">
        <div className="mb-10">
          <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
            Sistema de Gestión Pedagógica
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">
            Planifica<span className="text-blue-600">Ed</span>
          </h1>
          <p className="text-slate-500 font-medium leading-relaxed">
            Optimiza la planificación curricular con estándares de excelencia.
          </p>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100">
          {user ? (
            <div className="space-y-6">
              <div className="bg-blue-50 py-4 rounded-2xl">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Sesión Iniciada</p>
                <p className="text-xl font-black text-slate-800">{profile?.nombre}</p>
              </div>
              <Link href="/dashboard" className="block w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-1">
                Ir al Dashboard
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              <Link href="/login" className="bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 hover:bg-black transition-all hover:-translate-y-1 text-sm">
                Iniciar Sesión Docente
              </Link>
              <div className="py-2 flex items-center gap-4 text-slate-300">
                <div className="flex-1 h-px bg-slate-100"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest">O</span>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>
              <Link href="/register-admin" className="border-2 border-slate-200 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all text-sm">
                Registrar Institución
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}