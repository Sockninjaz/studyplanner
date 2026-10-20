export const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB strict cap

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: 'png' | 'jpeg' | 'pdf';
  mimeType?: string;
}

/**
 * Validates file buffer against 4 MB maximum size, allowed MIME types,
 * and cryptographically verifies magic bytes to prevent file spoofing.
 */
export function validateUploadFile(
  buffer: Buffer,
  declaredMimeType?: string
): FileValidationResult {
  // 1. Strict Size Check
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Bestand is leeg.' };
  }

  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    const sizeInMb = (buffer.length / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Bestandsgrootte (${sizeInMb} MB) overschrijdt de maximale limiet van 4 MB.`,
    };
  }

  // 2. Binary Magic Bytes Verification
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  // JPEG magic bytes: FF D8 FF
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  // PDF magic bytes: %PDF- (25 50 44 46 2D)
  const isPdf =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d;

  if (!isPng && !isJpeg && !isPdf) {
    return {
      valid: false,
      error: 'Ongeldig bestandstype. Alleen echte PNG, JPEG of PDF documenten zijn toegestaan.',
    };
  }

  const detectedType = isPng ? 'png' : isJpeg ? 'jpeg' : 'pdf';
  const detectedMime = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'application/pdf';

  // 3. Compare with declared MIME if provided
  if (declaredMimeType) {
    const normalizedDeclared = declaredMimeType.toLowerCase().trim();
    const isDeclaredAllowed = ALLOWED_MIME_TYPES.some(t => normalizedDeclared.includes(t));
    if (!isDeclaredAllowed) {
      return {
        valid: false,
        error: `Niet-ondersteund MIME type: ${declaredMimeType}. Toegestaan: PNG, JPEG, PDF.`,
      };
    }
  }

  return {
    valid: true,
    detectedType,
    mimeType: detectedMime,
  };
}
