const nextConfig = {
  /* config options here */
  // Exclude the functions directory from the build
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('firebase-functions', 'redis', '@redis/client');
    }
    // Explicitly exclude functions directory
    config.resolve.alias = {
      ...config.resolve.alias,
      'firebase-functions': false,
      redis: false,
      '@redis/client': false,
    };
    return config;
  },
  // External packages for server components
  serverExternalPackages: ['firebase-functions', 'redis', '@redis/client'],
};

module.exports = nextConfig; 