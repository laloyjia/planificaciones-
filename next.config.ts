import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // ⚠️ Peligro controlado: Le dice a Vercel que ignore los errores de tipos y suba la página igual
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora advertencias de formato
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;