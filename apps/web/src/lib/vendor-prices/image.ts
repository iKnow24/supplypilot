/** Upload rules for price screenshots, shared by the browser (early feedback) and server. */

/** Keeps the base64 image under the AI's 5 MB per-image limit. */
export const MAX_IMAGE_BYTES = 3_500_000;
/** Longest edge the browser scales a photo down to before upload (still crisp for reading). */
export const MAX_IMAGE_EDGE = 2000;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** The real type from the file's first bytes; the browser-supplied type isn't trusted. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const at = (i: number, ...b: number[]) => b.every((x, j) => bytes[i + j] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

export function describeLimit(): string {
  return `${(MAX_IMAGE_BYTES / 1_000_000).toFixed(1)} MB`;
}
