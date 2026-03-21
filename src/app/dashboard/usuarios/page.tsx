"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { registerTeacher } from "@/lib/firebase/auth-service";
import Link from "next/link";

export default function UsuariosPage() {
  const { profile } = useAuth();
  const [teacherData, setTeacherData] = useState({ nombre: "", email: "", pass: "", asignaturas: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const asigList = teacherData.asignaturas.split(",").map(a => a.trim());
    const res = await registerTeacher(teacherData.email, teacherData.pass, teacherData.nombre, asigList, profile?.establecimiento || "");
    if(res.success) alert("¡Docente registrado!");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <Link href="/dashboard" className="text-blue-600 font-bold mb-8 inline-block hover:underline">← Volver al Panel</Link>
      
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-white">
          <h2 className="text-3xl font-black mb-6 text-slate-900">Registrar Nuevo Docente</h2>
          <form onSubmit={handleCreate} className="space-y-4">
             <input className="w-full p-4 bg-slate-50 rounded-2xl" placeholder="Nombre completo" onChange={e => setTeacherData({...teacherData, nombre: e.target.value})} required />
             <input className="w-full p-4 bg-slate-50 rounded-2xl" type="email" placeholder="Email institucional" onChange={e => setTeacherData({...teacherData, email: e.target.value})} required />
             <input className="w-full p-4 bg-slate-50 rounded-2xl" type="password" placeholder="Contraseña provisoria" onChange={e => setTeacherData({...teacherData, pass: e.target.value})} required />
             <input className="w-full p-4 bg-slate-50 rounded-2xl" placeholder="Asignaturas (Matemática, Historia...)" onChange={e => setTeacherData({...teacherData, asignaturas: e.target.value})} required />
             <button className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all">Registrar en Sistema</button>
          </form>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 italic uppercase tracking-widest">Lista de Usuarios</h3>
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
             <p className="text-slate-400 text-sm italic">Aquí aparecerá la tabla de profesores pronto...</p>
          </div>
        </div>
      </div>
    </div>
  );
}