import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@aimarket/ui"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "http", hostname: "localhost", port: "4000" },
      { protocol: "http", hostname: "119.29.173.89", port: "4100" },
      { protocol: "http", hostname: "127.0.0.1", port: "4100" },
    ],
  },
};

export default nextConfig;
