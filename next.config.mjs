/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable experimental features for better performance
    optimizeCss: true,
  },
  // CORS headers for OBS Browser Source compatibility
  async headers() {
    return [
      {
        source: '/overlay/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

export default nextConfig;