import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext inspects multipart requests before dispatching route handlers.
  // Allow multipart overhead; the upload route independently enforces 5 MiB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
