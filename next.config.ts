import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El generador de PDF usa dependencias nativas de Node que no deben
  // empaquetarse con el bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
  // El PDF incrusta el logo leyéndolo del disco (lib/logo.ts). En Vercel los
  // archivos de public/ no están en el filesystem de las funciones a menos que
  // se los incluya explícitamente aquí.
  outputFileTracingIncludes: {
    "/**": ["./public/marca/**"],
  },
};

export default nextConfig;
