"use client";
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError("Correo o contraseña incorrectos");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-10 rounded-[32px] shadow-2xl">
        <button onClick={() => router.push('/')} className="text-slate-400 hover:text-blue-600 mb-8 flex items-center gap-2 text-sm font-bold">
          ← VOLVER
        </button>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Ingresar</h1>
        <p className="text-slate-500 mb-8">Usa tu cuenta institucional para continuar.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-medium border border-red-100">{error}</div>}
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 ml-1 uppercase">Email</label>
            <input className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all" type="email" placeholder="ejemplo@colegio.cl" onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 ml-1 uppercase">Contraseña</label>
            <input className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all" type="password" placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all mt-4">
            Entrar al Sistema
          </button>
        </form>
      </div>
    </div>
  );
}