import crypto from 'crypto';

export interface ZKProofInput {
  walletAddress: string;
  proofType: 'balance' | 'transaction' | 'identity' | 'range' | 'ownership';
  claim: string;
  privateData: Record<string, any>;
  publicData?: Record<string, any>;
}

export interface CryptographicProof {
  proofHash: string;
  commitment: string;
  nullifier: string;
  publicInputs: string[];
  timestamp: number;
  proofType: string;
  verified: boolean;
  protocol: 'hmac-commitment' | 'pedersen-hash' | 'light-protocol-ready';
  blindingFactor: string;
  metadata: {
    claim: string;
    createdAt: string;
    expiresAt: string;
    version: string;
    securityLevel: 'cryptographic-commitment' | 'zk-ready';
    description: string;
  };
}

export interface ProofVerificationResult {
  valid: boolean;
  commitment: string;
  nullifier: string;
  reason?: string;
  securityLevel: string;
}

class ZKProofService {
  private readonly PROOF_VERSION = '2.1.0';
  private readonly PROOF_EXPIRY_DAYS = 30;
  private readonly HMAC_KEY_LENGTH = 32;
  private readonly MASTER_SECRET: string;
  private readonly ENCRYPTION_KEY: Buffer;

  constructor() {
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      throw new Error('SESSION_SECRET environment variable is required for ZK proof security. Please configure it in your environment.');
    }
    this.MASTER_SECRET = sessionSecret;
    this.ENCRYPTION_KEY = crypto.createHash('sha256').update(sessionSecret + ':encryption').digest();
  }

  private generateSecureRandom(length: number = 32): Buffer {
    return crypto.randomBytes(length);
  }

  private encryptBlindingFactor(blindingHex: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(blindingHex, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private decryptBlindingFactor(encryptedData: string): string {
    const data = Buffer.from(encryptedData, 'base64');
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  private sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private sha512(data: string): string {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  private hmac256(key: Buffer, data: string): string {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  private deriveWalletSecret(walletAddress: string): Buffer {
    const derivedKey = crypto.createHmac('sha256', this.MASTER_SECRET)
      .update(`wallet:${walletAddress}`)
      .digest();
    return derivedKey;
  }

  private createHMACCommitment(value: string, blindingFactor: Buffer): { commitment: string; blindingHex: string } {
    const commitment = this.hmac256(blindingFactor, value);
    return {
      commitment,
      blindingHex: blindingFactor.toString('hex'),
    };
  }

  private createDeterministicNullifier(walletAddress: string, proofType: string, claimData: string): string {
    const walletSecret = this.deriveWalletSecret(walletAddress);
    const nullifierData = `nullifier:${proofType}:${this.sha256(claimData)}`;
    return this.hmac256(walletSecret, nullifierData);
  }

  private createProofHash(
    commitment: string,
    nullifier: string,
    publicInputs: string[],
    timestamp: number,
    blindingFactor: string
  ): string {
    const data = [commitment, nullifier, blindingFactor, ...publicInputs, timestamp.toString()].join('|');
    return this.sha512(data);
  }

  async generateBalanceProof(
    walletAddress: string,
    balance: number,
    tokenSymbol: string,
    threshold?: number
  ): Promise<CryptographicProof> {
    const blindingFactor = this.generateSecureRandom(this.HMAC_KEY_LENGTH);
    
    const balanceCommitmentData = JSON.stringify({
      wallet: this.sha256(walletAddress),
      token: tokenSymbol,
      balanceHash: this.sha256(balance.toString()),
    });

    const { commitment, blindingHex } = this.createHMACCommitment(balanceCommitmentData, blindingFactor);
    const claimData = `balance:${tokenSymbol}:${this.sha256(balance.toString())}`;
    const nullifier = this.createDeterministicNullifier(walletAddress, 'balance', claimData);
    
    const publicInputs: string[] = [
      this.sha256(walletAddress),
      tokenSymbol,
      `commitment_type:hmac-sha256`,
    ];

    if (threshold !== undefined) {
      const thresholdMet = balance >= threshold;
      publicInputs.push(`threshold_check:${thresholdMet}`);
    }

    const timestamp = Date.now();
    const proofHash = this.createProofHash(commitment, nullifier, publicInputs, timestamp, blindingHex);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.PROOF_EXPIRY_DAYS);

    return {
      proofHash,
      commitment,
      nullifier,
      publicInputs,
      timestamp,
      proofType: 'balance',
      verified: false,
      protocol: 'hmac-commitment',
      blindingFactor: blindingHex,
      metadata: {
        claim: threshold 
          ? `Cryptographic commitment proving balance threshold status for ${tokenSymbol}`
          : `Cryptographic commitment proving ${tokenSymbol} ownership without revealing amount`,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        version: this.PROOF_VERSION,
        securityLevel: 'cryptographic-commitment',
        description: 'HMAC-based commitment with blinding factor. Provides computational hiding - balance cannot be recovered without the blinding factor. Note: This is a cryptographic commitment, not a full zero-knowledge proof. For true ZK proofs, Light Protocol integration is required.',
      },
    };
  }

  async generateRangeProof(
    walletAddress: string,
    value: number,
    minValue: number,
    maxValue: number,
    label: string
  ): Promise<CryptographicProof> {
    const blindingFactor = this.generateSecureRandom(this.HMAC_KEY_LENGTH);

    const inRange = value >= minValue && value <= maxValue;
    
    const rangeCommitmentData = JSON.stringify({
      wallet: this.sha256(walletAddress),
      valueHash: this.sha256(value.toString()),
      range: { min: minValue, max: maxValue },
      label,
    });

    const { commitment, blindingHex } = this.createHMACCommitment(rangeCommitmentData, blindingFactor);
    const claimData = `range:${label}:${minValue}:${maxValue}:${this.sha256(value.toString())}`;
    const nullifier = this.createDeterministicNullifier(walletAddress, 'range', claimData);
    
    const publicInputs: string[] = [
      this.sha256(walletAddress),
      `range:[${minValue},${maxValue}]`,
      `in_range:${inRange}`,
      label,
      `commitment_type:hmac-sha256`,
    ];

    const timestamp = Date.now();
    const proofHash = this.createProofHash(commitment, nullifier, publicInputs, timestamp, blindingHex);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.PROOF_EXPIRY_DAYS);

    return {
      proofHash,
      commitment,
      nullifier,
      publicInputs,
      timestamp,
      proofType: 'range',
      verified: inRange,
      protocol: 'hmac-commitment',
      blindingFactor: blindingHex,
      metadata: {
        claim: `Cryptographic commitment for range check [${minValue}, ${maxValue}] - Result: ${inRange ? 'IN RANGE' : 'OUT OF RANGE'}`,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        version: this.PROOF_VERSION,
        securityLevel: 'cryptographic-commitment',
        description: 'HMAC-based range commitment. The exact value is hidden but the range check result is revealed. Note: For true zero-knowledge range proofs (where even the range check is proven without revealing it), Bulletproofs or similar schemes are required.',
      },
    };
  }

  async generateTransactionProof(
    walletAddress: string,
    txSignature: string,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<CryptographicProof> {
    const blindingFactor = this.generateSecureRandom(this.HMAC_KEY_LENGTH);
    
    const txCommitmentData = JSON.stringify({
      wallet: this.sha256(walletAddress),
      txHash: this.sha256(txSignature),
      fromToken,
      toToken,
      amountHash: this.sha256(amount.toString()),
    });

    const { commitment, blindingHex } = this.createHMACCommitment(txCommitmentData, blindingFactor);
    const claimData = `tx:${this.sha256(txSignature)}:${fromToken}:${toToken}`;
    const nullifier = this.createDeterministicNullifier(walletAddress, 'transaction', claimData);
    
    const publicInputs: string[] = [
      this.sha256(walletAddress),
      this.sha256(txSignature),
      `swap:${fromToken}->${toToken}`,
      `commitment_type:hmac-sha256`,
    ];

    const timestamp = Date.now();
    const proofHash = this.createProofHash(commitment, nullifier, publicInputs, timestamp, blindingHex);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.PROOF_EXPIRY_DAYS);

    return {
      proofHash,
      commitment,
      nullifier,
      publicInputs,
      timestamp,
      proofType: 'transaction',
      verified: false,
      protocol: 'hmac-commitment',
      blindingFactor: blindingHex,
      metadata: {
        claim: `Cryptographic commitment for ${fromToken} to ${toToken} swap transaction`,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        version: this.PROOF_VERSION,
        securityLevel: 'cryptographic-commitment',
        description: 'HMAC-based transaction commitment. Links a transaction to a wallet without revealing the swap amount. The transaction signature hash is included for verification.',
      },
    };
  }

  async generateIdentityProof(
    walletAddress: string,
    identityData: Record<string, string>
  ): Promise<CryptographicProof> {
    const blindingFactor = this.generateSecureRandom(this.HMAC_KEY_LENGTH);
    
    const identityHash = this.sha256(JSON.stringify(identityData));
    
    const identityCommitmentData = JSON.stringify({
      wallet: this.sha256(walletAddress),
      identityHash,
    });

    const { commitment, blindingHex } = this.createHMACCommitment(identityCommitmentData, blindingFactor);
    const claimData = `identity:${identityHash}`;
    const nullifier = this.createDeterministicNullifier(walletAddress, 'identity', claimData);
    
    const publicInputs: string[] = [
      this.sha256(walletAddress),
      'identity_committed',
      `commitment_type:hmac-sha256`,
    ];

    const timestamp = Date.now();
    const proofHash = this.createProofHash(commitment, nullifier, publicInputs, timestamp, blindingHex);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.PROOF_EXPIRY_DAYS);

    return {
      proofHash,
      commitment,
      nullifier,
      publicInputs,
      timestamp,
      proofType: 'identity',
      verified: false,
      protocol: 'hmac-commitment',
      blindingFactor: blindingHex,
      metadata: {
        claim: 'Cryptographic commitment binding identity data to wallet',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        version: this.PROOF_VERSION,
        securityLevel: 'cryptographic-commitment',
        description: 'HMAC-based identity commitment. The identity data is hashed and committed with a blinding factor. The commitment can later be opened to prove identity without revealing details until opened.',
      },
    };
  }

  async generateOwnershipProof(
    walletAddress: string,
    assetId: string,
    assetType: string
  ): Promise<CryptographicProof> {
    const blindingFactor = this.generateSecureRandom(this.HMAC_KEY_LENGTH);
    
    const ownershipCommitmentData = JSON.stringify({
      wallet: this.sha256(walletAddress),
      asset: this.sha256(assetId),
      type: assetType,
    });

    const { commitment, blindingHex } = this.createHMACCommitment(ownershipCommitmentData, blindingFactor);
    const claimData = `ownership:${assetType}:${this.sha256(assetId)}`;
    const nullifier = this.createDeterministicNullifier(walletAddress, 'ownership', claimData);
    
    const publicInputs: string[] = [
      this.sha256(walletAddress),
      this.sha256(assetId),
      assetType,
      `commitment_type:hmac-sha256`,
    ];

    const timestamp = Date.now();
    const proofHash = this.createProofHash(commitment, nullifier, publicInputs, timestamp, blindingHex);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.PROOF_EXPIRY_DAYS);

    return {
      proofHash,
      commitment,
      nullifier,
      publicInputs,
      timestamp,
      proofType: 'ownership',
      verified: false,
      protocol: 'hmac-commitment',
      blindingFactor: blindingHex,
      metadata: {
        claim: `Cryptographic commitment proving ${assetType} ownership`,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        version: this.PROOF_VERSION,
        securityLevel: 'cryptographic-commitment',
        description: 'HMAC-based ownership commitment. Proves a wallet has committed to owning a specific asset without revealing the asset details until the commitment is opened.',
      },
    };
  }

  verifyProofIntegrity(proof: CryptographicProof): ProofVerificationResult {
    try {
      const recalculatedHash = this.createProofHash(
        proof.commitment,
        proof.nullifier,
        proof.publicInputs,
        proof.timestamp,
        proof.blindingFactor
      );

      if (recalculatedHash !== proof.proofHash) {
        return {
          valid: false,
          commitment: proof.commitment,
          nullifier: proof.nullifier,
          reason: 'Proof hash integrity check failed - data may have been tampered with',
          securityLevel: proof.metadata.securityLevel,
        };
      }

      const expiresAt = new Date(proof.metadata.expiresAt);
      if (new Date() > expiresAt) {
        return {
          valid: false,
          commitment: proof.commitment,
          nullifier: proof.nullifier,
          reason: 'Proof has expired',
          securityLevel: proof.metadata.securityLevel,
        };
      }

      return {
        valid: true,
        commitment: proof.commitment,
        nullifier: proof.nullifier,
        securityLevel: proof.metadata.securityLevel,
      };
    } catch (error) {
      return {
        valid: false,
        commitment: proof.commitment,
        nullifier: proof.nullifier,
        reason: 'Proof verification error',
        securityLevel: 'unknown',
      };
    }
  }

  verifyCommitmentOpening(
    commitment: string,
    blindingFactor: string,
    originalData: string
  ): boolean {
    try {
      const blindingBuffer = Buffer.from(blindingFactor, 'hex');
      const recomputedCommitment = this.hmac256(blindingBuffer, originalData);
      return recomputedCommitment === commitment;
    } catch {
      return false;
    }
  }

  verifyNullifierUniqueness(nullifier: string, usedNullifiers: Set<string>): boolean {
    return !usedNullifiers.has(nullifier);
  }

  createCompressedProofData(proof: CryptographicProof): string {
    const encryptedBlinding = this.encryptBlindingFactor(proof.blindingFactor);
    const compressedData = {
      h: proof.proofHash,
      c: proof.commitment,
      n: proof.nullifier,
      eb: encryptedBlinding,
      t: proof.timestamp,
      p: proof.proofType,
      v: proof.verified,
      pr: proof.protocol,
    };
    return Buffer.from(JSON.stringify(compressedData)).toString('base64');
  }

  parseCompressedProofData(compressedData: string): Partial<CryptographicProof> | null {
    try {
      const decoded = JSON.parse(Buffer.from(compressedData, 'base64').toString('utf-8'));
      
      let blindingFactor: string | undefined;
      if (decoded.eb) {
        blindingFactor = this.decryptBlindingFactor(decoded.eb);
      } else if (decoded.b) {
        blindingFactor = decoded.b;
      }
      
      return {
        proofHash: decoded.h,
        commitment: decoded.c,
        nullifier: decoded.n,
        blindingFactor,
        timestamp: decoded.t,
        proofType: decoded.p,
        verified: decoded.v,
        protocol: decoded.pr,
      };
    } catch (error) {
      console.error('Error parsing compressed proof data:', error);
      return null;
    }
  }
}

export const zkProofService = new ZKProofService();

export type { CryptographicProof as ZKProof };
