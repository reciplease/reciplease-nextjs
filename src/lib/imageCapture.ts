// Downscales and re-encodes an image as JPEG, returning the raw base64 payload
// (no `data:` prefix — callers add that only when rendering). Keeps pantry
// item thumbnails small enough to store directly on the document in Mongo.
// Browser-only (uses Image/canvas), so it's exercised manually rather than in
// Jest/jsdom.
export async function compressToBase64(
  source: File | Blob,
  maxDim = 480,
  quality = 0.75,
): Promise<string> {
  const objectUrl = URL.createObjectURL(source);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return dataUrl.slice(dataUrl.indexOf(',') + 1);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

export function toDataUrl(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}
