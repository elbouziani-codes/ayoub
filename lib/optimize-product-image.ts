/** Browser-only preparation; the upload endpoint still validates every file. */
export const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ProductImageErrorCode = "invalid" | "decode" | "unsupported" | "tooLarge";
export class ProductImageError extends Error {
  constructor(public readonly code: ProductImageErrorCode) {
    super(code);
    this.name = "ProductImageError";
  }
}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const image = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: image, width: image.width, height: image.height, release: () => image.close() };
    } catch {
      // Some browsers support this API but not every accepted image format.
    }
  }
  if (typeof window.Image !== "function" || typeof URL.createObjectURL !== "function") throw new ProductImageError("unsupported");
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  image.decoding = "async";
  const release = () => { image.onload = null; image.onerror = null; image.src = ""; URL.revokeObjectURL(url); };
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { release(); reject(new ProductImageError("decode")); }, 15000);
    image.onload = () => {
      window.clearTimeout(timer);
      if (!image.naturalWidth || !image.naturalHeight) { release(); reject(new ProductImageError("decode")); return; }
      resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, release });
    };
    image.onerror = () => { window.clearTimeout(timer); release(); reject(new ProductImageError("decode")); };
    image.src = url;
  });
}

async function validFileKind(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte);
  if (file.type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return file.type === "image/webp" && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

export async function optimizeProductImage(file: File): Promise<File> {
  if (!ALLOWED_TYPES.includes(file.type) || !file.size || file.size > IMAGE_UPLOAD_MAX_BYTES || !await validFileKind(file)) throw new ProductImageError("invalid");
  const image = await decodeImage(file);
  const withinDimensions = image.width > 0 && image.height > 0 && image.width <= MAX_EDGE && image.height <= MAX_EDGE;
  let canvas: HTMLCanvasElement | null = null;
  try {
    if (!image.width || !image.height) throw new ProductImageError("decode");
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.toBlob !== "function") throw new ProductImageError("unsupported");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    const output = await new Promise<Blob>((resolve, reject) => {
      canvas!.toBlob((blob) => blob?.size ? resolve(blob) : reject(new ProductImageError("unsupported")), "image/webp", 0.85);
    });
    // WebP-unsupported browsers return PNG; keep that resized, valid fallback.
    if (!ALLOWED_TYPES.includes(output.type)) throw new ProductImageError("unsupported");
    if (withinDimensions && file.size <= output.size) return file;
    if (output.size > IMAGE_UPLOAD_MAX_BYTES) throw new ProductImageError("tooLarge");
    // The original filename survives; MIME and encoded bytes determine R2's extension.
    return new File([output], file.name, { type: output.type, lastModified: file.lastModified });
  } catch (error) {
    // A compliant original remains usable when a browser cannot encode images.
    if (withinDimensions) return file;
    if (error instanceof ProductImageError) throw error;
    throw new ProductImageError("unsupported");
  } finally {
    image.release();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
