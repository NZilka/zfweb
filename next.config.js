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

import path from "node:path";
import { fileURLToPath } from "node:url";

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
    // Both UploadThing hosts: utfs.io (legacy shared host, still what the
    // deprecated `file.url` returns) and <appId>.ufs.sh (per-app host behind
    // `file.ufsUrl`, already written by the staging re-key script). A URL on
    // an unlisted host makes next/image throw during render.
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io", pathname: "/f/**" },
      { protocol: "https", hostname: "*.ufs.sh", pathname: "/f/**" },
    ],
  },
  // `typescript.ignoreBuildErrors` was removed: the build now fails on type
  // errors, and CI runs `pnpm check` (typecheck + lint) before it.
  // Pin the workspace root so Turbopack stops inferring it from a stray
  // lockfile in the home directory.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default config;
