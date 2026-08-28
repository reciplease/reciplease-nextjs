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
      // Old /inventory/** -> /pantry/** redirects live in src/proxy.ts instead: its
      // middleware matcher covers /inventory/** and runs before these redirects ever
      // would, so a redirect defined here would never actually fire.
    ];
  },
}

module.exports = nextConfig
