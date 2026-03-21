"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { logoutUser } from "@/lib/firebase/auth-service";
import Link from "next/link";
import { useRouter } from "next/navigation"; // 1. IMPORTAMOS EL ROUTER

export default function DashboardPage() {
  const { profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const router = useRouter(); // 2. INICIALIZAMOS EL ROUTER

  // 3. CREAMOS LA FUNCIÓN DE SALIDA
  const handleCerrarSesion = async () => {
    try {
      await logoutUser(); // Desconecta de Firebase
      router.push("/login"); // Fuerza el salto a la pantalla de login
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 bg-blue-600 rounded-xl"></div>
        <p className="text-slate-400 font-bold animate-bounce uppercase text-xs tracking-widest">Sincronizando Panel...</p>
      </div>
    </div>
  );

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Navbar Superior */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-200">
              P
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Planifica<span className="text-blue-600">Ed</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full uppercase tracking-widest">
              {profile?.role}
            </span>
            {/* 4. ACTUALIZAMOS EL BOTÓN */}
            <button 
              onClick={handleCerrarSesion} 
              className="group flex items-center gap-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 px-5 py-2.5 rounded-2xl text-xs font-black transition-all border border-transparent hover:border-red-100"
            >
              CERRAR SESIÓN
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        {/* Header Dinámico */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.3em] mb-2 block">
              {isAdmin ? "Gestión de Institución" : "Espacio de Trabajo Docente"}
            </span>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              Hola, <span className="text-blue-600">{profile?.nombre?.split(' ')[0] || "Docente"}</span>
            </h2>
            <div className="flex items-center gap-2 mt-3">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <p className="text-slate-500 font-bold text-sm">
                Liceo: <span className="text-slate-900">{profile?.establecimiento || "No asignado"}</span>
               </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex bg-slate-200/50 p-1.5 rounded-2xl w-fit border border-slate-200 backdrop-blur-sm">
              <TabButton 
                label="General" 
                active={activeTab === "overview"} 
                onClick={() => setActiveTab("overview")} 
              />
              <TabButton 
                label="Ajustes" 
                active={activeTab === "config"} 
                onClick={() => setActiveTab("config")} 
              />
            </div>
          )}
        </header>

        {activeTab === "overview" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {isAdmin ? (
              <>
                <MenuCard 
                  href="/dashboard/admin/usuarios"
                  icon="👥"
                  title="Gestión Usuarios"
                  desc="Administra el acceso de docentes y roles del sistema."
                  color="blue"
                />
                <MenuCard 
                  href="/dashboard/admin/curriculum"
                  icon="📚"
                  title="Malla Curricular"
                  desc="Define los módulos y aprendizajes por especialidad."
                  color="green"
                  highlight
                />
                <MenuCard 
                  href="/dashboard/admin/reportes"
                  icon="📊"
                  title="Reportes"
                  desc="Analiza la cobertura curricular y descargas PDF."
                  color="purple"
                />
              </>
            ) : (
              <>
                <MenuCard 
                  href="/dashboard/planificacion"
                  icon="🚀"
                  title="Nueva Planificación"
                  desc="Crea tu diseño de aula, contenidos y descarga tu PDF oficial."
                  color="blue"
                  highlight
                />
                <MenuCard 
                  href="/dashboard/guias"
                  icon="📄"
                  title="Mis Documentos"
                  desc="Historial de planificaciones guardadas y descargables."
                  color="purple"
                />
                <MenuCard 
                  href="/dashboard/recursos"
                  icon="💡"
                  title="Materiales"
                  desc="Normativa vigente y sugerencias pedagógicas EMTP."
                  color="green"
                />
              </>
            )}
          </div>
        ) : (
          <SettingsPanel />
        )}

        {/* Sección de Módulos Rápidos para Docentes */}
        {!isAdmin && profile?.modulosAsignados && profile.modulosAsignados.length > 0 && (
          <section className="mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center gap-4 mb-8">
                <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Acceso Rápido por Módulo</h3>
                <div className="h-[2px] flex-1 bg-slate-200"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {profile.modulosAsignados.map((mod, index) => (
                <div key={index} className="group bg-white p-6 rounded-[2rem] border border-slate-200 flex flex-col gap-4 shadow-sm hover:shadow-xl hover:border-blue-500 transition-all duration-300">
                   <span className="font-black text-slate-800 uppercase text-xs leading-tight h-10 line-clamp-2">{mod}</span>
                   <Link 
                    href={`/dashboard/planificacion?modulo=${encodeURIComponent(mod)}`} 
                    className="w-fit bg-slate-50 group-hover:bg-blue-600 group-hover:text-white text-blue-600 font-black text-[10px] px-4 py-2 rounded-xl transition-colors"
                   >
                    PLANIFICAR →
                   </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES ---

function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
        active ? 'bg-white shadow-lg text-blue-600 scale-100' : 'text-slate-500 hover:text-slate-700 scale-95 opacity-70'
      }`}
    >
      {label.toUpperCase()}
    </button>
  );
}

function MenuCard({ href, icon, title, desc, color, highlight }: any) {
  const colors: any = {
    blue: "group-hover:bg-blue-600 bg-blue-50 text-blue-600 shadow-blue-100",
    green: "group-hover:bg-green-600 bg-green-50 text-green-600 shadow-green-100",
    purple: "group-hover:bg-purple-600 bg-purple-50 text-purple-600 shadow-purple-100"
  };

  return (
    <Link href={href} className={`group bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden ${highlight ? 'ring-2 ring-blue-500 ring-offset-4' : ''}`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-6 transition-all duration-500 group-hover:text-white group-hover:rotate-6 shadow-lg ${colors[color]}`}>
        {icon}
      </div>
      <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tighter uppercase italic">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">{desc}</p>
      <div className="absolute bottom-6 right-8 text-blue-600 font-black text-xs opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all">
        INGRESAR →
      </div>
    </Link>
  );
}

function SettingsPanel() {
  return (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 uppercase italic italic">Configuración de Periodo</h3>
          <div className="grid gap-4">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Año Académico Activo</label>
             <select className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none font-bold text-slate-700 appearance-none ring-2 ring-slate-100 focus:ring-blue-500 transition-all outline-none">
               <option>2026 - Año en curso</option>
               <option>2027 - Planificación previa</option>
             </select>
          </div>
        </div>
      </div>
    </div>
  );
}