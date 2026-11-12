export function fileSignatureMatches(bytes, mime) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > 5242880) return false;
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  if (mime === 'image/png') return [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  if (mime === 'application/pdf') return String.fromCharCode(...bytes.slice(0,5)) === '%PDF-' && new TextDecoder().decode(bytes.slice(-1024)).includes('%%EOF');
  return false;
}
export async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2,'0')).join('');
}
export function approvedScan(result, hash, size) {
  return result && typeof result.clean === 'boolean' && result.sha256 === hash && result.byteSize === size && typeof result.engine === 'string' && result.engine.length > 0 && result.engine.length <= 120;
}
