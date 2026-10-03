import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/mobile', destination: '/home', permanent: true },
      { source: '/mobile/tasks', destination: '/tasks', permanent: true },
      { source: '/mobile/deadlines', destination: '/deadlines', permanent: true },
      { source: '/mobile/search', destination: '/search', permanent: true },
    ]
  },
};

export default nextConfig;
