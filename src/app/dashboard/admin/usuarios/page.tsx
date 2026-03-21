"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { registerTeacher } from "@/lib/firebase/auth-service";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";

interface Docente {
  id: string;
  nombre: string;
  email: string;
  modulosAsignados: string[];
}

type ModulosPorGrupo = Record<string, string[]>;
interface EstructuraFormativa {
  "Formación TP": ModulosPorGrupo;
  "Formación General Básica": ModulosPorGrupo;
  "Formación HC": ModulosPorGrupo;
}

export default function UsuariosPage() {
  const { profile } = useAuth();
  
  // Estados
  const [formData, setFormData] = useState({ nombre: "", email: "", pass: "", confirmPass: "" });
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState<{ id: string; nombre: string; modulosAsignados: string[] } | null>(null);

  // Estado jerárquico para los módulos
  const [estructura, setEstructura] = useState<EstructuraFormativa>({
    "Formación TP": {},
    "Formación General Básica": {},
    "Formación HC": {}
  });

  // Estados para abrir/cerrar los acordeones de las categorías
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<string[]>(["Formación TP"]);

  const toggleCategoria = (cat: string) => {
    setCategoriasAbiertas(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  // ==========================================
  // ESCÁNER JERÁRQUICO
  // ==========================================
  const cargarTodo = async () => {
    setLoading(true);
    try {
      // 1. Obtener Docentes Actuales
      const uSnap = await getDocs(collection(db, "users"));
      const docentesCargados = uSnap.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre || d.data().name || "Sin Nombre",
        email: d.data().email || "Sin Email",
        modulosAsignados: d.data().modulosAsignados || [],
      }));
      setDocentes(docentesCargados);

      // 2. Escanear Colección "curriculum" y agrupar
      const cSnap = await getDocs(collection(db, "curriculum"));
      
      const nuevaEstructura: EstructuraFormativa = {
        "Formación TP": {},
        "Formación General Básica": {},
        "Formación HC": {}
      };

      cSnap.forEach(documento => {
        const data = documento.data();

        // Determinar Categoría (Si no tiene, asume TP por retrocompatibilidad)
        const tipoOriginal = data.tipoFormacion || data.tipo || "TP";
        let categoriaClave: keyof EstructuraFormativa = "Formación TP";
        
        if (tipoOriginal.toLowerCase().includes("básica") || tipoOriginal.toLowerCase().includes("basica")) {
          categoriaClave = "Formación General Básica";
        } else if (tipoOriginal.toLowerCase().includes("hc") || tipoOriginal.toLowerCase().includes("humanista")) {
          categoriaClave = "Formación HC";
        }

        // Determinar Especialidad/Asignatura
        const nombreGrupo = data.especialidad || data.asignatura || "General / Sin Asignar";

        // Inicializar el grupo si no existe
        if (!nuevaEstructura[categoriaClave][nombreGrupo]) {
          nuevaEstructura[categoriaClave][nombreGrupo] = [];
        }

        // Extraer los módulos
        const arrayDeModulos = data.malla || data.modulos || [];
        if (Array.isArray(arrayDeModulos)) {
          arrayDeModulos.forEach((modulo: any) => {
            if (modulo && modulo.nombre && typeof modulo.nombre === 'string' && modulo.nombre.trim() !== "") {
              const modNombre = modulo.nombre.trim();
              // Evitar duplicados dentro del mismo grupo
              if (!nuevaEstructura[categoriaClave][nombreGrupo].includes(modNombre)) {
                nuevaEstructura[categoriaClave][nombreGrupo].push(modNombre);
              }
            }
          });
        }
      });

      // Ordenar alfabéticamente los módulos dentro de cada grupo
      Object.keys(nuevaEstructura).forEach(cat => {
        const categoria = cat as keyof EstructuraFormativa;
        Object.keys(nuevaEstructura[categoria]).forEach(grupo => {
          nuevaEstructura[categoria][grupo].sort();
        });
      });

      setEstructura(nuevaEstructura);

    } catch (error) {
      console.error("❌ Error en carga:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const toggleModule = (mod: string, currentList: string[], setList: (list: string[]) => void) => {
    const newList = currentList.includes(mod) ? currentList.filter(m => m !== mod) : [...currentList, mod];
    setList(newList);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.pass !== formData.confirmPass) return alert("Las contraseñas no coinciden");
    
    try {
      const res = await registerTeacher(formData.email, formData.pass, formData.nombre, selectedModules, profile?.establecimiento || "Liceo");
      if (res.success) {
        alert("✅ Docente creado con éxito");
        setFormData({ nombre: "", email: "", pass: "", confirmPass: "" });
        setSelectedModules([]);
        cargarTodo();
      }
    } catch (e) { alert("Error al registrar"); }
  };

  const handleSaveEdit = async () => {
    if (!editData) return;
    try {
      await updateDoc(doc(db, "users", editData.id), { nombre: editData.nombre, modulosAsignados: editData.modulosAsignados });
      setDocentes(docentes.map(d => d.id === editData.id ? { ...d, nombre: editData.nombre, modulosAsignados: editData.modulosAsignados } : d));
      setEditData(null);
      alert("✅ Cambios guardados");
    } catch (e) { alert("Error al actualizar"); }
  };

  // Componente Reutilizable para Renderizar los Módulos Jerárquicos
  const renderArbolModulos = (listaSeleccionada: string[], setLista: (list: string[]) => void) => {
    return (
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {(Object.keys(estructura) as Array<keyof EstructuraFormativa>).map(categoria => {
          const grupos = estructura[categoria];
          const hasContent = Object.keys(grupos).length > 0;
          const isAbierto = categoriasAbiertas.includes(categoria);

          if (!hasContent) return null; // No mostrar categorías vacías

          return (
            <div key={categoria} className="border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
              <button 
                type="button" 
                onClick={() => toggleCategoria(categoria)}
                className="w-full bg-slate-50 p-4 flex justify-between items-center hover:bg-slate-100 transition-colors"
              >
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">{categoria}</h3>
                <span className="text-slate-400 font-black">{isAbierto ? "—" : "+"}</span>
              </button>
              
              {isAbierto && (
                <div className="p-5 space-y-6">
                  {Object.entries(grupos).map(([especialidad, modulos]) => (
                    <div key={especialidad} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <h4 className="text-[10px] font-black text-blue-600 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {especialidad}
                      </h4>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                        {modulos.map(mod => (
                          <label key={mod} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${listaSeleccionada.includes(mod) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-transparent hover:border-blue-200 shadow-sm'}`}>
                            <input type="checkbox" className="hidden" checked={listaSeleccionada.includes(mod)} onChange={() => toggleModule(mod, listaSeleccionada, setLista)} />
                            <span className="text-[9px] font-black uppercase leading-tight line-clamp-2">{mod}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 font-sans">
      {/* HEADER */}
      <div className="mb-10 flex justify-between items-center">
        <div>
          <Link href="/dashboard" className="text-blue-600 font-bold text-sm hover:underline">← Volver al Sistema</Link>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Personal</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* REGISTRO */}
        <div className="lg:col-span-7 bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
          <h2 className="text-2xl font-black mb-8 text-slate-800 italic">Registrar Docente</h2>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Nombre Completo" className="md:col-span-2 p-4 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} required />
              <input placeholder="Email" type="email" className="md:col-span-2 p-4 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              <input placeholder="Contraseña" type="password" className="p-4 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={formData.pass} onChange={e => setFormData({...formData, pass: e.target.value})} required />
              <input placeholder="Confirmar" type="password" className="p-4 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={formData.confirmPass} onChange={e => setFormData({...formData, confirmPass: e.target.value})} required />
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-400 uppercase mb-4 tracking-widest">Asignar Módulos / Asignaturas</h3>
              {renderArbolModulos(selectedModules, setSelectedModules)}
            </div>
            <button type="submit" className="w-full bg-[#0F172A] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all mt-4">Vincular Docente</button>
          </form>
        </div>

        {/* LISTA */}
        <div className="lg:col-span-5 bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col h-[800px]">
          <h2 className="text-2xl font-black mb-6 text-slate-800 italic">Personal Activo</h2>
          <input placeholder="Buscar docente..." className="w-full p-4 mb-6 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="space-y-4 overflow-y-auto flex-1">
            {docentes.filter(d => d.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(d => (
              <div key={d.id} className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-xl transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-black text-slate-800 text-base uppercase tracking-tighter">{d.nombre}</h4>
                    <p className="text-[10px] font-bold text-slate-400">{d.email}</p>
                  </div>
                  <button onClick={() => setEditData({ id: d.id, nombre: d.nombre, modulosAsignados: d.modulosAsignados })} className="text-[10px] font-black text-blue-600 border border-slate-200 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all">EDITAR</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {d.modulosAsignados.map(m => (
                    <span key={m} className="text-[8px] bg-white border px-2 py-1 rounded-lg font-black text-slate-500 uppercase">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL EDICIÓN */}
      {editData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] p-10 shadow-2xl">
            <h2 className="text-2xl font-black mb-6 uppercase">Editar Docente</h2>
            <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold mb-6 outline-none" value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} />
            
            <h3 className="text-sm font-black text-slate-400 uppercase mb-4 tracking-widest">Modificar Asignaciones</h3>
            <div className="mb-8">
              {renderArbolModulos(editData.modulosAsignados, (newList) => setEditData({...editData, modulosAsignados: newList}))}
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setEditData(null)} className="flex-1 font-black text-slate-400 uppercase border-2 border-slate-100 rounded-2xl hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSaveEdit} className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase shadow-lg hover:bg-emerald-600 transition-all">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}