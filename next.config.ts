import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the Cloud Run Docker image - Next bundles the server with
  // a minimal set of dependencies into .next/standalone
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Receipt photos are scaled down in the browser to well under 2 MB; the
      // limit leaves room for a photo the browser could not shrink (HEIC)
      bodySizeLimit: "9mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          // The camera is used through <input capture>, which needs no permission
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
