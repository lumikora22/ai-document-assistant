import path from 'node:path';

// Load the monorepo root .env so the frontend shares its values with the API.
// Next has already loaded its own env by the time this file runs, so
// @next/env's loadEnvConfig would just return that cached result; Node's
// loader reads the file and keeps variables that are already set (like the
// PORT Next is listening on).
try {
  process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

// Where the NestJS API listens. The browser never calls it directly: requests
// to /api/* on the frontend are proxied to it, so no CORS setup is needed and
// the app works from any host (localhost, 127.0.0.1, LAN IP).
const API_URL = (process.env.API_URL || 'http://localhost:3001').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Gzip would buffer the chat's Server-Sent Events and delay the tokens.
  compress: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
