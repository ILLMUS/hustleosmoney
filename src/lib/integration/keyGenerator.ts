import crypto from 'crypto';

export interface GeneratedKey {
  rawApiKey: string;     // Shown ONCE to the user/app (e.g. BUSINESSOS_LIVE_...)
  keyPrefix: string;     // Stored in DB for easy identification/lookup
  apiKeyHash: string;    // SHA-256 hashed version stored safely in DB
}

/**
 * Generates a secure, branded API Key for an external integration like Business OS.
 * @param appPrefix Prefix to identify the integration (e.g., "BUSINESSOS", "CRM", "ACCOUNTING")
 * @param environment "live" or "test"
 */
export function generateIntegrationKey(
  appPrefix: string = 'BUSINESSOS',
  environment: 'live' | 'test' = 'live'
): GeneratedKey {
  // 1. Generate 32 bytes of cryptographically secure random entropy
  const randomBytes = crypto.randomBytes(32).toString('hex');

  // 2. Format custom key (e.g., BUSINESSOS_LIVE_7a8b9c1d...)
  const prefix = `${appPrefix.toUpperCase()}_${environment.toUpperCase()}`;
  const rawApiKey = `${prefix}_${randomBytes}`;

  // 3. Compute SHA-256 hash for secure database storage
  const apiKeyHash = crypto
    .createHash('sha256')
    .update(rawApiKey)
    .digest('hex');

  return {
    rawApiKey,
    keyPrefix: prefix,
    apiKeyHash,
  };
}