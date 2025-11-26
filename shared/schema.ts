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

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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
