export type RemovedPhoto = { uri: string; index: number };

export function movePhoto(photos: string[], from: number, to: number): string[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= photos.length || to >= photos.length || from === to) return photos;
  const next = [...photos];
  const [photo] = next.splice(from, 1);
  next.splice(to, 0, photo);
  return next;
}

/** Undo restores the old position, including the cover, without exceeding the existing five-photo limit. */
export function restorePhoto(photos: string[], removed: RemovedPhoto): string[] {
  if (photos.length >= 5 || photos.includes(removed.uri)) return photos;
  const next = [...photos];
  next.splice(Math.max(0, Math.min(removed.index, next.length)), 0, removed.uri);
  return next;
}
