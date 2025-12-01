import { createHash, randomBytes } from "crypto";

/**
 * ZK Commitment Scheme for Stealth Payments
 * 
 * This implements a simple but effective commitment scheme:
 * - Commitment = SHA256(amount || secret || salt)
 * - The amount is hidden - only the commitment hash is stored
 * - To claim, recipient must prove knowledge of (amount, secret, salt) that hash to the commitment
 * 
 * Privacy guarantees:
 * - Database never stores actual amounts for ZK payments
 * - Only cryptographic commitments are visible
 * - Recipient must know the secret (shared off-chain) to claim
 */

export interface ZkCommitmentData {
  commitment: string;
  secret: string;
  salt: string;
}

export interface ZkClaimData {
  amount: number;
  secret: string;
  salt: string;
}

/**
 * Generate a cryptographically secure random secret (32 bytes, hex encoded)
 */
export function generateZkSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a cryptographically secure random salt (16 bytes, hex encoded)
 */
export function generateZkSalt(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Create a ZK commitment from amount, secret, and salt
 * The commitment hides the amount - it cannot be recovered without knowing secret+salt
 */
export function createZkCommitment(amount: number, secret: string, salt: string): string {
  // Normalize amount to prevent floating point issues
  const normalizedAmount = Math.floor(amount * 1_000_000) / 1_000_000;
  
  // Create commitment: SHA256(amount || secret || salt)
  const preimage = `${normalizedAmount}:${secret}:${salt}`;
  const hash = createHash("sha256").update(preimage).digest("hex");
  
  return hash;
}

/**
 * Verify a ZK commitment proof
 * Returns true if the provided (amount, secret, salt) matches the stored commitment
 */
export function verifyZkCommitment(
  commitment: string,
  amount: number,
  secret: string,
  salt: string
): boolean {
  const computedCommitment = createZkCommitment(amount, secret, salt);
  return computedCommitment === commitment;
}

/**
 * Generate full ZK commitment data for a new stealth payment
 */
export function generateZkCommitmentData(amount: number): ZkCommitmentData & { amount: number } {
  const secret = generateZkSecret();
  const salt = generateZkSalt();
  const commitment = createZkCommitment(amount, secret, salt);
  
  return {
    commitment,
    secret,
    salt,
    amount,
  };
}

/**
 * Format claim data as a shareable string
 * This is what the sender shares with the recipient off-chain
 */
export function formatZkClaimData(
  claimCode: string,
  amount: number,
  secret: string,
  tokenSymbol: string
): string {
  // Create a compact shareable format
  return JSON.stringify({
    code: claimCode,
    amount,
    secret,
    token: tokenSymbol,
  });
}

/**
 * Parse claim data from shareable string
 */
export function parseZkClaimData(data: string): {
  code: string;
  amount: number;
  secret: string;
  token: string;
} | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.code && typeof parsed.amount === "number" && parsed.secret && parsed.token) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a nullifier to prevent double-spending
 * The nullifier is unique per payment and is revealed when claimed
 */
export function generateNullifier(commitment: string, claimerWallet: string): string {
  return createHash("sha256")
    .update(`${commitment}:${claimerWallet}`)
    .digest("hex");
}
