import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // permite dockerizar o web na VPS (tambem funciona no Vercel normalmente)
  output: "standalone",
};

export default nextConfig;
