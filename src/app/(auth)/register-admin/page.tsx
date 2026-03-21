"use client";
import React, { useState } from "react";
import { registerAdmin } from "@/lib/firebase/auth-service";
import { useRouter } from "next/navigation";

export default function RegisterAdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [colegio, setColegio] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await registerAdmin(email, password, nombre, colegio);
    if (result.success) {
      router.push("/dashboard");
    } else {
      alert("Error: " + result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card max-w-xl w-full p-12 rounded-[40px] shadow-2xl border border-white">
        <h1 className="text-3xl font-black text-slate-900 mb-2">Registro de Institución</h1>
        <p className="text-slate-500 mb-10 font-medium text-lg">Crea la cuenta maestra de UTP.</p>
        
        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nombre Completo del Admin</label>
            <input className="w-full p-4 bg-slate-50 border-none rounded-2xl" type="text" placeholder="Ej: Juan Pérez" onChange={(e) => setNombre(e.target.value)} required />
          </div>
          
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nombre del Establecimiento</label>
            <input className="w-full p-4 bg-slate-50 border-none rounded-2xl" type="text" placeholder="Ej: Liceo Bicentenario..." onChange={(e) => setColegio(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email Institucional</label>
            <input className="w-full p-4 bg-slate-50 border-none rounded-2xl" type="email" placeholder="admin@colegio.cl" onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Contraseña</label>
            <input className="w-full p-4 bg-slate-50 border-none rounded-2xl" type="password" placeholder="Min. 6 caracteres" onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button className="md:col-span-2 w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-2xl hover:bg-black transition-all mt-4">
            Crear Cuenta Master Admin
          </button>
        </form>
      </div>
    </div>
  );
}