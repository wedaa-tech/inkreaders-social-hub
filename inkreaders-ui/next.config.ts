import type { NextConfig } from "next";

const API_BASE = process.env.API_BASE || "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy everything under /api/** except /api/auth/**
      {
        source: "/api/:path((?!auth).*)", // regex: exclude "auth"
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
