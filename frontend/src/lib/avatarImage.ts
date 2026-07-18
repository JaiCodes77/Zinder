/** Client-side avatar prep — resize + JPEG compress before POST /profiles. */

export const AVATAR_MAX_EDGE = 512;
export const AVATAR_MAX_INPUT_BYTES = 8 * 1024 * 1024;
/** Target data-URL payload size after compression (approx). */
export const AVATAR_MAX_OUTPUT_BYTES = 180_000;

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function isAllowedAvatarMime(type: string): boolean {
  return ALLOWED.has(type.toLowerCase());
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read image.'));
    };
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = src;
  });
}

/**
 * Resize longest edge to AVATAR_MAX_EDGE and encode as JPEG data URL.
 * Falls back to the original data URL when canvas is unavailable and the file is small.
 */
export async function compressAvatarFile(file: File): Promise<string> {
  if (!isAllowedAvatarMime(file.type)) {
    throw new Error('Use a JPEG, PNG, WebP, or GIF image.');
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    throw new Error('Image must be under 8MB.');
  }

  const original = await readFileAsDataURL(file);

  try {
    const img = await loadImage(original);
    const scale = Math.min(1, AVATAR_MAX_EDGE / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (original.length <= AVATAR_MAX_OUTPUT_BYTES * 1.37) return original;
      throw new Error('Could not compress image in this browser.');
    }
    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > AVATAR_MAX_OUTPUT_BYTES * 1.37 && quality > 0.45) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  } catch (err) {
    if (original.length <= AVATAR_MAX_OUTPUT_BYTES * 1.37) return original;
    throw err instanceof Error ? err : new Error('Could not process image.');
  }
}
