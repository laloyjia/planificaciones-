import { db } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";

export const createUserProfile = async (uid: string, data: any) => {
  try {
    await setDoc(doc(db, "users", uid), {
      ...data,
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error creando perfil:", error);
    return { success: false, error };
  }
};