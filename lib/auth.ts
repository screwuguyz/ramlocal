// Authentication utilities
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/**
 * Check if a string is already a bcrypt hash
 */
export function isBcryptHash(str: string): boolean {
  // Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters long
  return /^\$2[aby]\$\d{2}\$.{53}$/.test(str);
}

/**
 * Verify credentials and handle automatic migration from plain text to hashed passwords
 *
 * @param email - User email
 * @param password - Password attempt
 * @param storedEmail - Stored email from env
 * @param storedPassword - Stored password from env (may be plain or hashed)
 * @returns Object with success status and optional migration flag
 */
export async function verifyCredentials(
  email: string,
  password: string,
  storedEmail: string,
  storedPassword: string
): Promise<{ success: boolean; needsMigration?: boolean; newHash?: string }> {
  // Check email first
  if (email.toLowerCase() !== storedEmail.toLowerCase()) {
    return { success: false };
  }

  // Check if stored password is already hashed
  if (isBcryptHash(storedPassword)) {
    // Compare with bcrypt
    const match = await comparePassword(password, storedPassword);
    return { success: match };
  }

  // Legacy plain text password - compare directly
  if (password === storedPassword) {
    // Password matches! Generate hash for migration
    const newHash = await hashPassword(password);
    return {
      success: true,
      needsMigration: true,
      newHash,
    };
  }

  return { success: false };
}
