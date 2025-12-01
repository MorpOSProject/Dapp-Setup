import { z } from "zod";
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Database tables for persistence

// Swap orders table
export const swapOrders = pgTable("swap_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  fromToken: text("from_token").notNull(),
  toToken: text("to_token").notNull(),
  fromAmount: real("from_amount").notNull(),
  toAmount: real("to_amount").notNull(),
  slippage: real("slippage").notNull(),
  status: text("status").notNull().default("pending"),
  isPrivate: boolean("is_private").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  txSignature: text("tx_signature"),
  jupiterQuoteId: text("jupiter_quote_id"),
});

// Batched actions table
export const batchedActions = pgTable("batched_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  token: text("token").notNull(),
  status: text("status").notNull().default("queued"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  batchId: text("batch_id"),
  executedAt: timestamp("executed_at"),
  txSignature: text("tx_signature"),
  metadata: jsonb("metadata").$type<{
    fromToken?: string;
    toToken?: string;
    fromAmount?: number;
    toAmount?: number;
    slippage?: number;
  }>(),
});

// Disclosure proofs table
export const disclosureProofs = pgTable("disclosure_proofs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  proofType: text("proof_type").notNull(),
  recipientAddress: text("recipient_address").notNull(),
  recipientName: text("recipient_name"),
  selectedItems: jsonb("selected_items").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  proofHash: text("proof_hash").notNull(),
  status: text("status").notNull().default("active"),
});

// Activities/Transaction history table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  token: text("token").notNull(),
  valueUsd: real("value_usd").notNull(),
  isPrivate: boolean("is_private").notNull().default(true),
  status: text("status").notNull().default("pending"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  txSignature: text("tx_signature"),
});

// Portfolio snapshots for analytics
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  totalValue: real("total_value").notNull(),
  shadowValue: real("shadow_value").notNull(),
  publicValue: real("public_value").notNull(),
  holdings: jsonb("holdings").notNull().$type<any[]>(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Yield strategies table
export const yieldStrategies = pgTable("yield_strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  name: text("name").notNull(),
  protocol: text("protocol").notNull(),
  strategyType: text("strategy_type").notNull(),
  depositToken: text("deposit_token").notNull(),
  depositAmount: real("deposit_amount").notNull(),
  currentValue: real("current_value").notNull(),
  apy: real("apy").notNull(),
  rewards: real("rewards").notNull().default(0),
  rewardsToken: text("rewards_token"),
  isPrivate: boolean("is_private").notNull().default(true),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Compliance rules table
export const complianceRules = pgTable("compliance_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  ruleType: text("rule_type").notNull(),
  conditions: jsonb("conditions").notNull().$type<Record<string, any>>(),
  actions: jsonb("actions").notNull().$type<Record<string, any>>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Audit trail table
export const auditTrail = pgTable("audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  proofHash: text("proof_hash"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Shadow balances table - tracks how much of each token is in "shadow" vs "public"
export const shadowBalances = pgTable("shadow_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  tokenMint: text("token_mint").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  shadowAmount: real("shadow_amount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ZK Proofs table - Real cryptographic proofs
export const zkProofs = pgTable("zk_proofs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  proofType: text("proof_type").notNull(), // balance, transaction, identity, range, ownership
  proofHash: text("proof_hash").notNull(),
  commitment: text("commitment").notNull(),
  nullifier: text("nullifier").notNull().unique(),
  publicInputs: jsonb("public_inputs").notNull().$type<string[]>(),
  protocol: text("protocol").notNull().default("pedersen"),
  claim: text("claim").notNull(),
  verified: boolean("verified").notNull().default(false),
  compressedData: text("compressed_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
});

// Stealth payments table - private transfers with no public link
// Supports ZK Commitment scheme for enhanced privacy
export const stealthPayments = pgTable("stealth_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderWallet: text("sender_wallet").notNull(),
  recipientHint: text("recipient_hint"), // Optional hint for intended recipient (not their actual address)
  tokenMint: text("token_mint").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  amount: real("amount").notNull(), // For non-ZK payments, or 0 for ZK payments
  valueUsd: real("value_usd").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, claimed, expired, cancelled
  claimCode: text("claim_code").notNull().unique(), // Secret code to claim payment
  stealthKey: text("stealth_key").notNull(), // One-time key for privacy
  message: text("message"), // Optional encrypted message
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  claimedAt: timestamp("claimed_at"),
  claimedByWallet: text("claimed_by_wallet"),
  txSignature: text("tx_signature"),
  // ZK Commitment fields for enhanced privacy
  zkEnabled: boolean("zk_enabled").notNull().default(false), // Whether ZK commitment is used
  zkCommitment: text("zk_commitment"), // SHA256(amount || secret || salt) - hides actual amount
  zkSalt: text("zk_salt"), // Random salt for commitment uniqueness
  zkSecret: text("zk_secret"), // Secret needed to claim (shared off-chain with recipient)
});

// Multi-sig wallets table - private multi-signature wallets
export const multisigWallets = pgTable("multisig_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  creatorWallet: text("creator_wallet").notNull(),
  threshold: integer("threshold").notNull(), // Required approvals (e.g., 2 of 3)
  totalMembers: integer("total_members").notNull(),
  // Aggregated public key for privacy - on-chain only sees this single key
  aggregatedPubkey: text("aggregated_pubkey"),
  // Merkle root of member pubkey hashes - for ZK membership proofs
  membersMerkleRoot: text("members_merkle_root"),
  balance: real("balance").notNull().default(0),
  tokenMint: text("token_mint"), // Primary token for this wallet
  tokenSymbol: text("token_symbol"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Multi-sig members table - stores members with privacy
export const multisigMembers = pgTable("multisig_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull(),
  // Store hash of pubkey for privacy - actual pubkey only known to member
  memberPubkeyHash: text("member_pubkey_hash").notNull(),
  // Encrypted share for threshold signing (encrypted with member's key)
  encryptedShare: text("encrypted_share"),
  // Role: owner, admin, member
  role: text("role").notNull().default("member"),
  // Nickname/label (optional, for display)
  nickname: text("nickname"),
  // Status: active, pending, removed
  status: text("status").notNull().default("active"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  addedBy: text("added_by"),
});

// Multi-sig transactions table - pending transactions awaiting approval
export const multisigTransactions = pgTable("multisig_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull(),
  // Transaction type: transfer, add_member, remove_member, change_threshold
  txType: text("tx_type").notNull(),
  // Serialized transaction instructions (base64)
  serializedInstructions: text("serialized_instructions"),
  // Human-readable description
  description: text("description").notNull(),
  // Amount (for transfers)
  amount: real("amount"),
  tokenMint: text("token_mint"),
  tokenSymbol: text("token_symbol"),
  // Recipient (for transfers)
  recipientAddress: text("recipient_address"),
  // Current approval count
  approvalCount: integer("approval_count").notNull().default(0),
  // Required threshold at time of creation
  requiredApprovals: integer("required_approvals").notNull(),
  // Status: pending, approved, executed, rejected, expired, cancelled
  status: text("status").notNull().default("pending"),
  // Initiated by (pubkey hash for privacy)
  initiatedByHash: text("initiated_by_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  executedAt: timestamp("executed_at"),
  txSignature: text("tx_signature"),
});

// Multi-sig approvals table - private approvals with ZK commitments
export const multisigApprovals = pgTable("multisig_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull(),
  transactionId: varchar("transaction_id").notNull(),
  // ZK commitment proving membership without revealing identity
  // commitment = hash(pubkey + tx_id + nonce)
  approvalCommitment: text("approval_commitment").notNull(),
  // Nullifier to prevent double-approval (hash of pubkey + tx_id)
  nullifierHash: text("nullifier_hash").notNull().unique(),
  // Membership proof (ZK proof that signer is in merkle tree)
  membershipProof: text("membership_proof"),
  // Approval decision: approve or reject
  decision: text("decision").notNull().default("approve"),
  // Timestamp (slightly randomized for privacy)
  approvedAt: timestamp("approved_at").notNull().defaultNow(),
});

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// ============================================
// PRIVATE ROUTING LAYER TABLES
// ============================================

// Routing profiles - wallet-scoped privacy preferences
export const routingProfiles = pgTable("routing_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull().unique(),
  // Privacy feature toggles
  enableRouteObfuscation: boolean("enable_route_obfuscation").notNull().default(true),
  enableDecoyTransactions: boolean("enable_decoy_transactions").notNull().default(true),
  enableTimingRandomization: boolean("enable_timing_randomization").notNull().default(true),
  enableTransactionSplitting: boolean("enable_transaction_splitting").notNull().default(false),
  // Configuration values
  decoyDensity: integer("decoy_density").notNull().default(2), // 1-5 decoys per real tx
  minDelayMs: integer("min_delay_ms").notNull().default(1000), // Minimum jitter delay
  maxDelayMs: integer("max_delay_ms").notNull().default(5000), // Maximum jitter delay
  splitThreshold: real("split_threshold").notNull().default(1000), // Split txs above this USD value
  maxSplitParts: integer("max_split_parts").notNull().default(3), // Max parts to split into
  // Preferred relay nodes (hashed for privacy)
  preferredRelayHashes: text("preferred_relay_hashes").array(),
  // Privacy level: standard, enhanced, maximum
  privacyLevel: text("privacy_level").notNull().default("enhanced"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Routing batches - execution sessions with privacy metadata
export const routingBatches = pgTable("routing_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  // Randomness seed for deterministic decoy generation (allows replay verification)
  randomSeed: text("random_seed").notNull(),
  // Timing window for execution
  scheduledStartAt: timestamp("scheduled_start_at"),
  scheduledEndAt: timestamp("scheduled_end_at"),
  actualStartAt: timestamp("actual_start_at"),
  actualEndAt: timestamp("actual_end_at"),
  // Status: planning, scheduled, executing, completed, failed, cancelled
  status: text("status").notNull().default("planning"),
  // Total segments (real + decoy)
  totalSegments: integer("total_segments").notNull().default(0),
  completedSegments: integer("completed_segments").notNull().default(0),
  // Privacy metrics
  privacyScore: real("privacy_score").notNull().default(0), // 0-100
  obfuscationLevel: integer("obfuscation_level").notNull().default(0), // Decoy ratio
  timingJitterApplied: boolean("timing_jitter_applied").notNull().default(false),
  // Links to related transactions
  linkedSwapId: varchar("linked_swap_id"),
  linkedStealthPaymentId: varchar("linked_stealth_payment_id"),
  linkedBatchActionId: varchar("linked_batch_action_id"),
  // Metadata
  routeMetadata: jsonb("route_metadata").$type<{
    inputToken?: string;
    outputToken?: string;
    totalAmount?: number;
    splitCount?: number;
    decoyCount?: number;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Routing segments - individual hops (real or decoy)
export const routingSegments = pgTable("routing_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull(),
  // Segment type: real, decoy, split
  segmentType: text("segment_type").notNull(), // "real" | "decoy" | "split"
  // Order in the batch
  segmentIndex: integer("segment_index").notNull(),
  // Commitment for ZK verification: hash(batchId + index + secret)
  commitment: text("commitment").notNull(),
  // Nullifier to prevent replay: hash(batchId + wallet + segmentIndex)
  nullifierHash: text("nullifier_hash").notNull().unique(),
  // Route details (hashed for privacy)
  routeHashedId: text("route_hashed_id"), // Jupiter route ID hashed
  dexProtocolHash: text("dex_protocol_hash"), // Which DEX used (hashed)
  // Amounts (hidden for decoys)
  amount: real("amount"), // Null for decoys to hide pattern
  tokenMint: text("token_mint"),
  tokenSymbol: text("token_symbol"),
  // Scheduled timing with randomization
  scheduledAt: timestamp("scheduled_at"),
  executedAt: timestamp("executed_at"),
  delayAppliedMs: integer("delay_applied_ms").default(0),
  // Status: pending, executing, completed, failed, skipped
  status: text("status").notNull().default("pending"),
  // Transaction signature (only for executed real segments)
  txSignature: text("tx_signature"),
  // Error info if failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================
// LIGHT PROTOCOL ZK INTEGRATION TABLES
// ============================================

// Light Protocol configuration - wallet-scoped ZK settings
export const lightProtocolConfig = pgTable("light_protocol_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull().unique(),
  // ZK execution mode: simulator (default), zk_enabled
  zkMode: text("zk_mode").notNull().default("simulator"),
  // Cached state tree root for faster proof generation
  cachedStateRoot: text("cached_state_root"),
  // Last sync timestamp for state tree
  lastStateSyncAt: timestamp("last_state_sync_at"),
  // Merkle tree index for this wallet's notes
  merkleTreeIndex: integer("merkle_tree_index"),
  // Proof verification level: basic, standard, strict
  proofVerificationLevel: text("proof_verification_level").notNull().default("standard"),
  // Auto-refresh state tree interval in seconds (0 = manual)
  autoRefreshInterval: integer("auto_refresh_interval").notNull().default(60),
  // Maximum gas willing to pay for ZK transactions
  maxGasLamports: real("max_gas_lamports").notNull().default(10000000),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ZK Execution Sessions - tracks proof generation and submission
export const zkExecutionSessions = pgTable("zk_execution_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  batchId: varchar("batch_id").notNull(), // Links to routing_batches
  // State tree snapshot at session start
  stateRootSnapshot: text("state_root_snapshot").notNull(),
  // Proof artifacts
  proofData: text("proof_data"), // Serialized ZK proof
  proofType: text("proof_type").notNull().default("compressed_transfer"),
  // Proof generation status: pending, generating, generated, verified, failed
  proofStatus: text("proof_status").notNull().default("pending"),
  // Verification result
  verificationResult: boolean("verification_result"),
  verificationTimestamp: timestamp("verification_timestamp"),
  // Transaction data
  txSignature: text("tx_signature"),
  blockSlot: integer("block_slot"),
  // Compressed token operations
  inputNoteCommitments: text("input_note_commitments").array(),
  outputNoteCommitments: text("output_note_commitments").array(),
  // Nullifiers used in this session
  nullifiersUsed: text("nullifiers_used").array(),
  // Jupiter integration data
  jupiterQuoteId: text("jupiter_quote_id"),
  jupiterRouteHash: text("jupiter_route_hash"),
  // Error tracking
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Compressed notes - individual compressed token notes for privacy
export const compressedNotes = pgTable("compressed_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  segmentId: varchar("segment_id"), // Links to routing_segments
  sessionId: varchar("session_id"), // Links to zk_execution_sessions
  // Note commitment (Pedersen hash of amount + owner + randomness)
  noteCommitment: text("note_commitment").notNull().unique(),
  // Nullifier hash (prevents double-spending)
  nullifierHash: text("nullifier_hash").notNull().unique(),
  // Token information
  tokenMint: text("token_mint").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  // Amount stored in encrypted form
  encryptedAmount: text("encrypted_amount").notNull(),
  // Randomness used for commitment (encrypted with owner's key)
  encryptedRandomness: text("encrypted_randomness").notNull(),
  // Merkle tree position
  merkleTreeRoot: text("merkle_tree_root").notNull(),
  merkleProof: text("merkle_proof"), // Serialized merkle proof
  leafIndex: integer("leaf_index").notNull(),
  // Note status: active, spent, pending
  status: text("status").notNull().default("active"),
  // Whether this is a decoy note (zero-value for privacy)
  isDecoy: boolean("is_decoy").notNull().default(false),
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  spentAt: timestamp("spent_at"),
  spentInTxSignature: text("spent_in_tx_signature"),
});

// Route metrics - captured performance and privacy analytics
export const routeMetrics = pgTable("route_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  batchId: varchar("batch_id"),
  segmentId: varchar("segment_id"),
  // Performance metrics
  latencyMs: integer("latency_ms"),
  gasUsed: real("gas_used"),
  slippageActual: real("slippage_actual"),
  // Privacy metrics
  privacyScoreContribution: real("privacy_score_contribution"),
  decoyEffectiveness: real("decoy_effectiveness"), // How well decoys masked real tx
  timingEntropy: real("timing_entropy"), // Randomness in timing
  routeDiversity: real("route_diversity"), // How varied the route selection was
  // Success tracking
  success: boolean("success").notNull().default(true),
  failureReason: text("failure_reason"),
  // Aggregate stats
  metricType: text("metric_type").notNull(), // segment, batch, daily, weekly
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

// Insert schemas
export const insertSwapOrderSchema = createInsertSchema(swapOrders).omit({
  id: true,
  status: true,
  createdAt: true,
  completedAt: true,
  txSignature: true,
  jupiterQuoteId: true,
});

export const insertBatchedActionSchema = createInsertSchema(batchedActions).omit({
  id: true,
  status: true,
  createdAt: true,
  batchId: true,
  executedAt: true,
  txSignature: true,
});

export const insertDisclosureProofSchema = createInsertSchema(disclosureProofs).omit({
  id: true,
  createdAt: true,
  proofHash: true,
  status: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  timestamp: true,
});

export const insertYieldStrategySchema = createInsertSchema(yieldStrategies).omit({
  id: true,
  currentValue: true,
  rewards: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceRuleSchema = createInsertSchema(complianceRules).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertZkProofSchema = createInsertSchema(zkProofs).omit({
  id: true,
  createdAt: true,
  revokedAt: true,
});

export const insertShadowBalanceSchema = createInsertSchema(shadowBalances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStealthPaymentSchema = createInsertSchema(stealthPayments).omit({
  id: true,
  status: true,
  createdAt: true,
  claimedAt: true,
  claimedByWallet: true,
});

export const insertMultisigWalletSchema = createInsertSchema(multisigWallets).omit({
  id: true,
  balance: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMultisigMemberSchema = createInsertSchema(multisigMembers).omit({
  id: true,
  status: true,
  addedAt: true,
});

export const insertMultisigTransactionSchema = createInsertSchema(multisigTransactions).omit({
  id: true,
  approvalCount: true,
  status: true,
  createdAt: true,
  executedAt: true,
  txSignature: true,
});

export const insertMultisigApprovalSchema = createInsertSchema(multisigApprovals).omit({
  id: true,
  approvedAt: true,
});

// Private Routing Layer insert schemas
export const insertRoutingProfileSchema = createInsertSchema(routingProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoutingBatchSchema = createInsertSchema(routingBatches).omit({
  id: true,
  status: true,
  totalSegments: true,
  completedSegments: true,
  privacyScore: true,
  obfuscationLevel: true,
  timingJitterApplied: true,
  actualStartAt: true,
  actualEndAt: true,
  createdAt: true,
});

export const insertRoutingSegmentSchema = createInsertSchema(routingSegments).omit({
  id: true,
  status: true,
  executedAt: true,
  txSignature: true,
  errorMessage: true,
  createdAt: true,
});

export const insertRouteMetricSchema = createInsertSchema(routeMetrics).omit({
  id: true,
  recordedAt: true,
});

// Light Protocol ZK insert schemas
export const insertLightProtocolConfigSchema = createInsertSchema(lightProtocolConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZkExecutionSessionSchema = createInsertSchema(zkExecutionSessions).omit({
  id: true,
  proofStatus: true,
  verificationResult: true,
  verificationTimestamp: true,
  completedAt: true,
  createdAt: true,
});

export const insertCompressedNoteSchema = createInsertSchema(compressedNotes).omit({
  id: true,
  status: true,
  createdAt: true,
  spentAt: true,
  spentInTxSignature: true,
});

// Types from tables
export type SwapOrder = typeof swapOrders.$inferSelect;
export type InsertSwapOrder = z.infer<typeof insertSwapOrderSchema>;

export type BatchedAction = typeof batchedActions.$inferSelect;
export type InsertBatchedAction = z.infer<typeof insertBatchedActionSchema>;

export type DisclosureProof = typeof disclosureProofs.$inferSelect;
export type InsertDisclosureProof = z.infer<typeof insertDisclosureProofSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;

export type YieldStrategy = typeof yieldStrategies.$inferSelect;
export type InsertYieldStrategy = z.infer<typeof insertYieldStrategySchema>;

export type ComplianceRule = typeof complianceRules.$inferSelect;
export type InsertComplianceRule = z.infer<typeof insertComplianceRuleSchema>;

export type AuditTrailEntry = typeof auditTrail.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ZkProof = typeof zkProofs.$inferSelect;
export type InsertZkProof = z.infer<typeof insertZkProofSchema>;

export type ShadowBalanceRecord = typeof shadowBalances.$inferSelect;
export type InsertShadowBalance = z.infer<typeof insertShadowBalanceSchema>;

export type StealthPayment = typeof stealthPayments.$inferSelect;
export type InsertStealthPayment = z.infer<typeof insertStealthPaymentSchema>;

export type MultisigWallet = typeof multisigWallets.$inferSelect;
export type InsertMultisigWallet = z.infer<typeof insertMultisigWalletSchema>;

export type MultisigMember = typeof multisigMembers.$inferSelect;
export type InsertMultisigMember = z.infer<typeof insertMultisigMemberSchema>;

export type MultisigTransaction = typeof multisigTransactions.$inferSelect;
export type InsertMultisigTransaction = z.infer<typeof insertMultisigTransactionSchema>;

export type MultisigApproval = typeof multisigApprovals.$inferSelect;
export type InsertMultisigApproval = z.infer<typeof insertMultisigApprovalSchema>;

// Private Routing Layer types
export type RoutingProfile = typeof routingProfiles.$inferSelect;
export type InsertRoutingProfile = z.infer<typeof insertRoutingProfileSchema>;

export type RoutingBatch = typeof routingBatches.$inferSelect;
export type InsertRoutingBatch = z.infer<typeof insertRoutingBatchSchema>;

export type RoutingSegment = typeof routingSegments.$inferSelect;
export type InsertRoutingSegment = z.infer<typeof insertRoutingSegmentSchema>;

export type RouteMetric = typeof routeMetrics.$inferSelect;
export type InsertRouteMetric = z.infer<typeof insertRouteMetricSchema>;

// Light Protocol ZK types
export type LightProtocolConfig = typeof lightProtocolConfig.$inferSelect;
export type InsertLightProtocolConfig = z.infer<typeof insertLightProtocolConfigSchema>;

export type ZkExecutionSession = typeof zkExecutionSessions.$inferSelect;
export type InsertZkExecutionSession = z.infer<typeof insertZkExecutionSessionSchema>;

export type CompressedNote = typeof compressedNotes.$inferSelect;
export type InsertCompressedNote = z.infer<typeof insertCompressedNoteSchema>;

// Zod schemas for API validation (runtime types)
export const tokenSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  mint: z.string(),
  decimals: z.number(),
  logoUri: z.string().optional(),
  price: z.number().optional(),
  priceChange24h: z.number().optional(),
});

export type Token = z.infer<typeof tokenSchema>;

// Shadow balance - computed from on-chain data
export const shadowBalanceSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  tokenMint: z.string(),
  tokenSymbol: z.string(),
  shadowAmount: z.number(),
  publicAmount: z.number(),
  valueUsd: z.number(),
  lastUpdated: z.number(),
});

export type ShadowBalance = z.infer<typeof shadowBalanceSchema>;

// Portfolio holding - computed
export const portfolioHoldingSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  tokenMint: z.string(),
  tokenSymbol: z.string(),
  tokenName: z.string(),
  shadowBalance: z.number(),
  publicBalance: z.number(),
  valueUsd: z.number(),
  change24h: z.number(),
  logoUri: z.string().optional(),
});

export type PortfolioHolding = z.infer<typeof portfolioHoldingSchema>;

// DeFi position - computed
export const defiPositionSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  protocol: z.string(),
  protocolLogo: z.string().optional(),
  type: z.enum(["lending", "liquidity", "staking", "farming"]),
  depositedAmount: z.number(),
  depositedToken: z.string(),
  currentValue: z.number(),
  apy: z.number(),
  rewards: z.number(),
  rewardsToken: z.string(),
  isPrivate: z.boolean(),
});

export type DefiPosition = z.infer<typeof defiPositionSchema>;

// Portfolio stats - computed
export const portfolioStatsSchema = z.object({
  totalValue: z.number(),
  shadowValue: z.number(),
  publicValue: z.number(),
  change24h: z.number(),
  change24hPercent: z.number(),
  activePositions: z.number(),
  pendingActions: z.number(),
  privacyScore: z.number(),
});

export type PortfolioStats = z.infer<typeof portfolioStatsSchema>;

// Jupiter quote response
export const jupiterQuoteSchema = z.object({
  inputMint: z.string(),
  inAmount: z.string(),
  outputMint: z.string(),
  outAmount: z.string(),
  otherAmountThreshold: z.string(),
  swapMode: z.string(),
  slippageBps: z.number(),
  priceImpactPct: z.string(),
  routePlan: z.array(z.any()),
});

export type JupiterQuote = z.infer<typeof jupiterQuoteSchema>;

// Analytics types
export const analyticsStatsSchema = z.object({
  totalPnL: z.number(),
  pnlPercent: z.number(),
  totalVolume: z.number(),
  avgTradeSize: z.number(),
  winRate: z.number(),
  totalTrades: z.number(),
  bestTrade: z.number(),
  worstTrade: z.number(),
  privateRatio: z.number(),
  winningTrades: z.number(),
  losingTrades: z.number(),
});

export type AnalyticsStats = z.infer<typeof analyticsStatsSchema>;

export const pnlDataPointSchema = z.object({
  date: z.string(),
  pnl: z.number(),
  dailyPnL: z.number(),
  volume: z.number(),
  trades: z.number(),
});

export type PnLDataPoint = z.infer<typeof pnlDataPointSchema>;

export const activityBreakdownSchema = z.object({
  name: z.string(),
  value: z.number(),
  count: z.number(),
  color: z.string(),
});

export type ActivityBreakdown = z.infer<typeof activityBreakdownSchema>;

export const tradeRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  fromToken: z.string(),
  toToken: z.string(),
  fromAmount: z.number(),
  toAmount: z.number(),
  valueUsd: z.number(),
  pnl: z.number(),
  pnlPercent: z.number(),
  isPrivate: z.boolean(),
});

export type TradeRecord = z.infer<typeof tradeRecordSchema>;

// ============================================
// PRIVATE ROUTING LAYER API SCHEMAS
// ============================================

// Route plan request - input to generate a privacy-enhanced route plan
export const routePlanRequestSchema = z.object({
  walletAddress: z.string().min(32, "Valid wallet address required"),
  inputToken: z.string().min(1, "Input token required"),
  outputToken: z.string().min(1, "Output token required"),
  amount: z.number().positive("Amount must be positive"),
  slippageBps: z.number().min(0).max(10000).default(50),
  // Privacy options (optional, falls back to profile settings)
  enableDecoys: z.boolean().optional(),
  enableTimingJitter: z.boolean().optional(),
  enableSplitting: z.boolean().optional(),
  customDecoyCount: z.number().min(0).max(10).optional(),
});

export type RoutePlanRequest = z.infer<typeof routePlanRequestSchema>;

// Route segment preview - individual step in the route plan
export const routeSegmentPreviewSchema = z.object({
  index: z.number(),
  type: z.enum(["real", "decoy", "split"]),
  tokenSymbol: z.string().optional(),
  amountMasked: z.boolean(), // True if amount is hidden (for decoys)
  scheduledDelay: z.number(), // Delay in ms before execution
  dexProtocol: z.string().optional(), // DEX name (masked for decoys)
  commitment: z.string(), // ZK commitment for this segment
});

export type RouteSegmentPreview = z.infer<typeof routeSegmentPreviewSchema>;

// Route plan response - complete privacy-enhanced route plan
export const routePlanResponseSchema = z.object({
  batchId: z.string(),
  privacyScore: z.number().min(0).max(100),
  totalSegments: z.number(),
  realSegments: z.number(),
  decoySegments: z.number(),
  splitSegments: z.number(),
  estimatedDurationMs: z.number(),
  timingWindow: z.object({
    start: z.string(),
    end: z.string(),
  }),
  segments: z.array(routeSegmentPreviewSchema),
  obfuscationDetails: z.object({
    decoyDensity: z.number(),
    timingEntropyLevel: z.enum(["low", "medium", "high"]),
    routeDiversityScore: z.number(),
  }),
});

export type RoutePlanResponse = z.infer<typeof routePlanResponseSchema>;

// Execute route request
export const executeRouteRequestSchema = z.object({
  batchId: z.string().min(1, "Batch ID required"),
  walletAddress: z.string().min(32, "Valid wallet address required"),
  signedTransaction: z.string().optional(), // Base64 encoded signed tx
});

export type ExecuteRouteRequest = z.infer<typeof executeRouteRequestSchema>;

// Routing history item
export const routingHistoryItemSchema = z.object({
  batchId: z.string(),
  status: z.enum(["planning", "scheduled", "executing", "completed", "failed", "cancelled"]),
  privacyScore: z.number(),
  totalSegments: z.number(),
  completedSegments: z.number(),
  inputToken: z.string().optional(),
  outputToken: z.string().optional(),
  totalAmount: z.number().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export type RoutingHistoryItem = z.infer<typeof routingHistoryItemSchema>;

// Privacy metrics summary
export const privacyMetricsSummarySchema = z.object({
  averagePrivacyScore: z.number(),
  totalRoutedTransactions: z.number(),
  totalDecoysGenerated: z.number(),
  averageTimingEntropy: z.number(),
  routeDiversityScore: z.number(),
  bestPrivacyScore: z.number(),
  weeklyStats: z.array(z.object({
    week: z.string(),
    transactions: z.number(),
    avgPrivacyScore: z.number(),
  })),
});

export type PrivacyMetricsSummary = z.infer<typeof privacyMetricsSummarySchema>;
