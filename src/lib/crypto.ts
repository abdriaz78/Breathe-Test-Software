import crypto from "crypto";

// -----------------------------------------------------------------------------
// Field-level encryption for patient PII/PHI.
//
// We use AES-256-GCM (authenticated encryption). Each value gets a fresh random
// 12-byte IV; the stored token is base64(iv | authTag | ciphertext). Decryption
// verifies the auth tag, so tampering is detected.
//
// For MRN lookups we use a deterministic HMAC-SHA256 "blind index" so a patient
// can be found by MRN without decrypting every row. Blind indexes leak equality
// only (two identical MRNs hash the same), which is acceptable for an identifier.
// -----------------------------------------------------------------------------

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.PHI_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PHI_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `PHI_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`
    );
  }
  return key;
}

/** Encrypt a plaintext string. Returns a base64 token, or null for null input. */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/** Decrypt a token produced by `encrypt`. Returns null for null input. */
export function decrypt(token: string | null | undefined): string | null {
  if (token == null || token === "") return null;
  const key = getKey();
  const data = Buffer.from(token, "base64");
  const iv = data.subarray(0, IV_LEN);
  const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = data.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/**
 * Deterministic blind index for equality lookups (e.g. MRN). Same input +
 * same key => same hash. Normalizes case/whitespace before hashing.
 */
export function blindIndex(value: string): string {
  const key = getKey();
  const normalized = value.trim().toLowerCase();
  return crypto.createHmac("sha256", key).update(normalized).digest("hex");
}
