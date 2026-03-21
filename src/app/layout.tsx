import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

// Opcional: Esto le da el título a la pestaña del navegador
export const metadata = {
  title: "Planificador EMTP",
  description: "Planificador de clases IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}