import crypto from 'crypto';

/**
 * Generates a cryptographically secure, unguessable public share token.
 * Uses 24 bytes of high-entropy randomness encoded as URL-safe base64url (32 chars).
 * Never uses sequential IDs or predictable hashes.
 */
export function generateShareToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Validates whether a token string is a valid share token format.
 */
export function isValidShareToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  // URL-safe base64url characters: A-Z, a-z, 0-9, -, _
  // Length should typically be between 20 and 64 chars
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}
