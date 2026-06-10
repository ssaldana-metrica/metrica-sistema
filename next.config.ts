import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El generador de PDF usa dependencias nativas de Node que no deben
  // empaquetarse con el bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
