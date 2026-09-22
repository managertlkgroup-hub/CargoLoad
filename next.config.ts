import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // React Compiler (Next 16, стабильная опция) — мемоизация без ручных useMemo
  reactCompiler: true,
  reactStrictMode: false,
};

export default nextConfig;
