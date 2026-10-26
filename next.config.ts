import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// Read from .env at build time; HTTPS-only directives are skipped for local http testing.
const isHttps = (process.env.APP_URL ?? "").startsWith("https://");

/**
 * Content-Security-Policy without nonces: nonce-based CSP forces dynamic rendering and is
 * incompatible with Partial Prerendering (Cache Components), so inline scripts that Next.js
 * emits are allowed with 'unsafe-inline'. Everything else is locked to this origin: no external
 * scripts, styles, fonts, frames or connections; the site cannot be framed; forms post only here.
 * User-generated HTML is sanitized on the server before it is stored (src/lib/rich-text).
 */
const buildCsp = (world = false) => [
  "default-src 'self'",
  // 3D world only (`world`): 'wasm-unsafe-eval' lets its self-hosted model decoders (/atom-world/decoders)
  // compile WebAssembly — it does not allow JavaScript eval.
  `script-src 'self' 'unsafe-inline'${world ? " 'wasm-unsafe-eval'" : ""}${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // 3D world only: blob: — textures inside its character models are decoded from in-page blob URLs
  `connect-src 'self'${world ? " blob:" : ""}${isProd ? "" : " ws: wss:"}`,
  "media-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");
const csp = buildCsp();
/** The 3D world's pages (/atom-world, /atom-world/admin): the same policy plus the two additions above. */
const worldCsp = buildCsp(true);

const securityHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd && isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Applies to all Server Actions. Admin uploads send one image (≤ 5 MB) per request.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        // CSS modules (the 3D world's *.module.css) keep Next's own module handling; `as: "*.css"`
        // would turn them into global CSS and leave their class names undefined.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Uploaded files (/media/...) send their own stricter policy ("default-src 'none'; sandbox").
      { source: "/((?!media/).*)", headers: [{ key: "Content-Security-Policy", value: csp }] },
      // 3D world (src/atom-world): later rules override the policy above for its pages only
      { source: "/atom-world", headers: [{ key: "Content-Security-Policy", value: worldCsp }] },
      { source: "/atom-world/:path*", headers: [{ key: "Content-Security-Policy", value: worldCsp }] },
      // its offline worker and file list are never served stale; the worker (in /atom-world/) may
      // control the page /atom-world itself — nothing else of the site
      { source: "/atom-world/:file(sw\\.js|offline-manifest\\.json)", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/atom-world/sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/atom-world" }] },
    ];
  },
};

export default nextConfig;
