import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@aimarket/ui"],
  async redirects() {
    return [
      {
        source: "/workflow",
        destination: "/studio",
        permanent: true,
      },
      {
        source: "/workflows",
        destination: "/studio",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost", port: "4000" },
      { protocol: "http", hostname: "119.29.173.89", port: "4100" },
      { protocol: "http", hostname: "127.0.0.1", port: "4100" },
    ],
  },
};

export default nextConfig;
