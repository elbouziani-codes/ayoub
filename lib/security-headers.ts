export type SecurityHeader = { key: string; value: string };

/** Browser policy shared by storefront, administration, and API responses. */
export function buildSecurityHeaders(development = false): SecurityHeader[] {
  const scriptSources = ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])];
  const connectSources = ["'self'", ...(development ? ["ws:", "wss:"] : [])];
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Origin-Agent-Cluster", value: "?1" },
    { key: "Permissions-Policy", value: "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), publickey-credentials-get=(), usb=(), browsing-topics=()" },
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
  ];
}
