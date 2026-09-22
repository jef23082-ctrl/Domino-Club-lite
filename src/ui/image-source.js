export function optimizedImageSource(source) {
  const value = String(source || '');
  return /\.png(?=\?|$)/i.test(value) ? value.replace(/\.png(?=\?|$)/i, '.webp') : value;
}

export function imageSourceSet(source) {
  const fallback = String(source || '');
  return { preferred: optimizedImageSource(fallback), fallback };
}

export function setOptimizedImage(image, source) {
  if (!image) return image;
  const { preferred, fallback } = imageSourceSet(source);
  image.dataset.fallbackSrc = fallback;
  const selected = image.dataset.preferredFailed === preferred ? fallback : preferred;
  image.onerror = () => {
    if (image.dataset.preferredFailed === preferred) return;
    image.dataset.preferredFailed = preferred;
    image.onerror = null;
    image.src = fallback;
  };
  if (image.getAttribute('src') !== selected) image.src = selected;
  return image;
}

export async function loadOptimizedImage(source) {
  const { preferred, fallback } = imageSourceSet(source);
  const image = new Image();
  image.decoding = 'async';
  try {
    image.src = preferred;
    await image.decode();
  } catch {
    image.src = fallback;
    await image.decode();
  }
  return image;
}
