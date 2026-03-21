import { auth, db, firebaseConfig } from "./config";
// 1. initializeApp y getApps SIEMPRE van en firebase/app
import { initializeApp, getApps, getApp } from "firebase/app";
// 2. Las funciones de autenticación SIEMPRE van en firebase/auth
import { 
  createUserWithEmailAndPassword, 
  signOut,
  getAuth 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

/**
 * Lógica para la instancia secundaria.
 * Evita el error "Firebase: Firebase App named 'Secondary' already exists"
 */
const secondaryApp = getApps().find(a => a.name === "Secondary") 
  || initializeApp(firebaseConfig, "Secondary");

const secondaryAuth = getAuth(secondaryApp);

/**
 * Registra un administrador master en Firebase Auth y crea su perfil en Firestore.
 */
export const registerAdmin = async (email: string, pass: string, nombre: string, establecimiento: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      nombre: nombre,
      role: "admin", 
      establecimiento: establecimiento,
      asignaturas: [], 
      createdAt: new Date().toISOString(),
    });

    return { success: true, user };
  } catch (error: any) {
    console.error("Error en registerAdmin:", error.code, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Crea un docente (Solo invocable por Admin) sin cerrar sesión actual.
 */
export const registerTeacher = async (email: string, pass: string, nombre: string, asignaturas: string[], establecimiento: string) => {
  try {
    // Usamos secondaryAuth para no desloguear al Admin actual
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const newTeacher = userCredential.user;

    await setDoc(doc(db, "users", newTeacher.uid), {
      uid: newTeacher.uid,
      email: newTeacher.email,
      nombre: nombre,
      role: "docente",
      asignaturas: asignaturas,
      establecimiento: establecimiento,
      createdAt: new Date().toISOString(),
    });

    // Cerramos la sesión de la instancia secundaria inmediatamente
    await signOut(secondaryAuth);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error en registerTeacher:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Cierra la sesión activa del administrador/usuario
 */
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    console.error("Error al cerrar sesión:", error.message);
    return { success: false, error: error.message };
  }
};