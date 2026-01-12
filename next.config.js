/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
//import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   async redirects() {
//     return [
//     {
//       source: '/',
//     destination: '/shop',
//     permanent: true,
//     }
//   ]
//   },
//   images: {
//     remotePatterns: [{ hostname: "utfs.io" }],
//   },
//   typescript: {
//     ignoreBuildErrors: true,
//   },
//   eslint: {
//     ignoreDuringBuilds: true,
//   },
// }

/** @type {import("next").NextConfig} */
const config = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/shop",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [{ hostname: "utfs.io" }],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default config;
