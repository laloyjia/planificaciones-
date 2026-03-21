import { db } from "./config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Esta es la función que te faltaba exportar
export const guardarAsignacionDocente = async (data: any) => {
  try {
    // Creamos una referencia a una nueva colección llamada 'asignaciones'
    const docRef = await addDoc(collection(db, "asignaciones"), {
      ...data,
      createdAt: serverTimestamp(), // Es mejor usar el tiempo del servidor
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error al guardar asignación:", error);
    return { success: false, error };
  }
};