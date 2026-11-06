import { getStore } from "@netlify/blobs";

/** UUID image keys are immutable and retain the existing /api/images URLs. */
export function createNetlifyBucket() {
  const store = () => getStore({ name: "ayoub-product-images", region: "eu-central-1", consistency: "strong" });
  return {
    async get(key: string) {
      const entry = await store().getWithMetadata(key, { type: "arrayBuffer" });
      if (!entry?.data) return null;
      const digest = entry.etag ? null : await crypto.subtle.digest("SHA-256", entry.data);
      const httpEtag = entry.etag ?? `"${Array.from(new Uint8Array(digest!), byte => byte.toString(16).padStart(2, "0")).join("")}"`;
      return { body: entry.data, httpEtag };
    },
    async put(key: string, bytes: Uint8Array, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }) {
      await store().set(key, new Uint8Array(bytes).buffer, { metadata: options?.httpMetadata ?? {} });
    },
  };
}
