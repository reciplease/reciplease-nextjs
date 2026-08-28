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
      // The Inventory section was renamed to Pantry (routes, backend REST paths,
      // and Mongo collections all moved together) — permanently redirect any old
      // bookmarked /inventory/** link to its /pantry/** equivalent.
      {
        source: '/inventory',
        destination: '/pantry',
        permanent: true,
      },
      {
        source: '/inventory/:path*',
        destination: '/pantry/:path*',
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig
