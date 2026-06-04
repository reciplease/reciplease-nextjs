/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/recipes',
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig
