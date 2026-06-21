// Split out from backend.ts so Pages Router code (e.g. getServerSideProps in
// src/pages/**) can read the backend origin without transitively importing
// next/headers — Next.js refuses to bundle that import outside the App Router,
// even when the importing module never calls it.
export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';
