import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Alte Adressen der statischen Version weiterleiten (Links aus dem Bot, Lesezeichen)
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/creator.html", destination: "/registrieren", permanent: true },
      { source: "/dashboard.html", destination: "/dashboard", permanent: true },
      { source: "/marktplatz.html", destination: "/marketplace", permanent: false },
      { source: "/shop.html", destination: "/marketplace", permanent: false },
      { source: "/product.html", destination: "/marketplace", permanent: false },
    ];
  },
};

export default nextConfig;
