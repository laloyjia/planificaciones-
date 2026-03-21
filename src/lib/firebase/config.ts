import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Agregamos "export" para que auth-service pueda usarlo en la instancia secundaria
export const firebaseConfig = {
  apiKey: "AIzaSyC15dk1lxLlmCC2nnJ8zM4GHD3v_5HeJ-Q",
  authDomain: "planifica-edtech-21a5a.firebaseapp.com",
  projectId: "planifica-edtech-21a5a",
  storageBucket: "planifica-edtech-21a5a.firebasestorage.app",
  messagingSenderId: "910182032066",
  appId: "1:910182032066:web:613d6491ccdf09c69a115b",
  measurementId: "G-TNX9BL9WVW"
};

// Singleton para evitar múltiples inicializaciones en el desarrollo de Next.js
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };