import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Exclude the functions directory from the build
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('firebase-functions');
    }
    
    // Explicitly exclude functions directory
    config.resolve.alias = {
      ...config.resolve.alias,
      'firebase-functions': false,
    };
    
    return config;
  },
  // External packages for server components
  serverExternalPackages: ['firebase-functions'],
};

export default nextConfig;
