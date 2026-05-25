import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@aimarket/ui"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "http", hostname: "localhost", port: "4000" },
    ],
  },
};

export default nextConfig;
