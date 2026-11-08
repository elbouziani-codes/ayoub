import type { NextConfig } from "next";
import { resolve } from "node:path";

const isNetlify = process.env.NETLIFY === "true"
  || process.env.AYOUB_RUNTIME === "netlify";
const netlifySiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || process.env.URL
  || process.env.DEPLOY_PRIME_URL;

const nextConfig: NextConfig = {
  // Deliver descriptions, canonical URLs and social metadata in the initial
  // <head> for every client, including browsers without metadata streaming.
  htmlLimitedBots: /.*/,
  // Vinext inspects multipart requests before dispatching route handlers.
  // Allow multipart overhead; the upload route independently enforces 5 MiB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  ...(isNetlify ? {
    // This non-secret platform flag is compiled into the runtime adapter.
    // Credentials continue to be read from process.env on the server.
    env: {
      AYOUB_RUNTIME: "netlify",
      ...(netlifySiteUrl ? { NEXT_PUBLIC_SITE_URL: netlifySiteUrl } : {}),
    },
    webpack(config, { webpack }) {
      // Native Next.js on Netlify has no Cloudflare binding module. Replace
      // that server import before webpack tries to resolve its URL scheme.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /^cloudflare:workers$/,
        resolve(process.cwd(), "lib/server/netlify-env.ts"),
      ));
      return config;
    },
  } satisfies Partial<NextConfig> : {}),
};

export default nextConfig;
