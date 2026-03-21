"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth"; // <-- IMPORTAMOS signOut
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";

interface UserProfile {
  uid: string;
  email: string | null;
  role: "admin" | "docente";
  nombre?: string;
  establecimiento: string;
  especialidad: string;
  modulosAsignados: string[]; 
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>; // <-- DECLARAMOS LA FUNCIÓN
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {}, // <-- VALOR POR DEFECTO
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile({
              ...data,
              uid: firebaseUser.uid,
            });
          } else {
            console.warn("⚠️ Usuario autenticado pero sin documento en Firestore.");
            setProfile(null);
          }
        } catch (error) {
          console.error("❌ Error crítico obteniendo perfil de Firestore:", error);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // <-- CREAMOS LA FUNCIÓN DE CERRAR SESIÓN -->
  const logout = async () => {
    try {
      await signOut(auth); // Desconecta de Firebase
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}> {/* <-- PASAMOS LA FUNCIÓN */}
      {!loading && children} 
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);