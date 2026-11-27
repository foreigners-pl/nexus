import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/mobile', destination: '/home', permanent: true },
      { source: '/mobile/tasks', destination: '/requests', permanent: true },
      { source: '/mobile/deadlines', destination: '/actions', permanent: true },
      { source: '/mobile/search', destination: '/search', permanent: true },
      { source: '/tasks', destination: '/requests', permanent: true },
      { source: '/deadlines', destination: '/actions', permanent: true },
    ]
  },
};

export default nextConfig;
