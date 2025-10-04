/**
 * Password Hasher
 * Implements secure password hashing using PBKDF2 with Web Crypto API
 */

export class PasswordHasher {
  constructor() {
    this.iterations = 100000; // OWASP recommended minimum
    this.keyLength = 32; // 256 bits
    this.algorithm = 'SHA-256';
  }

  /**
   * Generate a random salt
   */
  generateSalt() {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return this.arrayBufferToBase64(salt);
  }

  /**
   * Hash a password using PBKDF2
   */
  async hashPassword(password, salt = null) {
    if (!salt) {
      salt = this.generateSalt();
    }

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = this.base64ToArrayBuffer(salt);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Derive key using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: this.iterations,
        hash: this.algorithm
      },
      keyMaterial,
      this.keyLength * 8
    );

    const hashArray = Array.from(new Uint8Array(derivedBits));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Return hash in format: iterations$algorithm$salt$hash
    return `${this.iterations}$${this.algorithm}$${salt}$${hashHex}`;
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password, storedHash) {
    try {
      const parts = storedHash.split('$');
      
      if (parts.length !== 4) {
        // Legacy SHA-256 hash (for backward compatibility)
        return await this.verifyLegacyPassword(password, storedHash);
      }

      const [iterations, algorithm, salt, hash] = parts;
      
      // Hash the provided password with the same parameters
      const computedHash = await this.hashPassword(password, salt);
      
      // Compare hashes
      return computedHash === storedHash;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Verify legacy SHA-256 password (for backward compatibility)
   */
  async verifyLegacyPassword(password, hash) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
  }

  /**
   * Check if a hash needs to be upgraded
   */
  needsUpgrade(storedHash) {
    const parts = storedHash.split('$');
    
    // Legacy hash format
    if (parts.length !== 4) {
      return true;
    }

    const [iterations] = parts;
    
    // Check if iterations are below current standard
    return parseInt(iterations) < this.iterations;
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const errors = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
