import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import {
  swapOrders,
  batchedActions,
  disclosureProofs,
  activities,
  portfolioSnapshots,
  yieldStrategies,
  complianceRules,
  auditTrail,
  users,
  zkProofs,
  shadowBalances,
  stealthPayments,
  multisigWallets,
  multisigMembers,
  multisigTransactions,
  multisigApprovals,
  routingProfiles,
  routingBatches,
  routingSegments,
  routeMetrics,
  lightProtocolConfig,
  zkExecutionSessions,
  compressedNotes,
  type SwapOrder,
  type BatchedAction,
  type DisclosureProof,
  type Activity,
  type PortfolioSnapshot,
  type YieldStrategy,
  type ComplianceRule,
  type AuditTrailEntry,
  type User,
  type ZkProof,
  type ShadowBalanceRecord,
  type StealthPayment,
  type MultisigWallet,
  type MultisigMember,
  type MultisigTransaction,
  type MultisigApproval,
  type RoutingProfile,
  type RoutingBatch,
  type RoutingSegment,
  type RouteMetric,
  type LightProtocolConfig,
  type ZkExecutionSession,
  type CompressedNote,
  type InsertSwapOrder,
  type InsertBatchedAction,
  type InsertDisclosureProof,
  type InsertActivity,
  type InsertYieldStrategy,
  type InsertComplianceRule,
  type InsertUser,
  type InsertZkProof,
  type InsertShadowBalance,
  type InsertStealthPayment,
  type InsertMultisigWallet,
  type InsertMultisigMember,
  type InsertMultisigTransaction,
  type InsertMultisigApproval,
  type InsertRoutingProfile,
  type InsertRoutingBatch,
  type InsertRoutingSegment,
  type InsertRouteMetric,
  type InsertLightProtocolConfig,
  type InsertZkExecutionSession,
  type InsertCompressedNote,
  type ShadowBalance,
  type PortfolioHolding,
  type DefiPosition,
  type PortfolioStats,
  type AnalyticsStats,
  type PnLDataPoint,
  type ActivityBreakdown,
  type TradeRecord,
} from "@shared/schema";
import { getWalletTokenData, TOKEN_MINTS, MINT_TO_SYMBOL } from "./solana";

export interface IStorage {
  // Portfolio (computed from chain)
  getPortfolioStats(walletAddress: string): Promise<PortfolioStats>;
  getPortfolioHoldings(walletAddress: string): Promise<PortfolioHolding[]>;
  getDefiPositions(walletAddress: string): Promise<DefiPosition[]>;
  savePortfolioSnapshot(walletAddress: string, snapshot: any): Promise<PortfolioSnapshot>;

  // Swaps
  createSwapOrder(order: InsertSwapOrder): Promise<SwapOrder>;
  getSwapOrders(walletAddress: string): Promise<SwapOrder[]>;
  updateSwapOrderStatus(id: string, status: string, txSignature?: string): Promise<SwapOrder | undefined>;

  // Batched Actions
  createBatchedAction(action: InsertBatchedAction): Promise<BatchedAction>;
  getBatchedActions(walletAddress: string): Promise<BatchedAction[]>;
  updateBatchedActionStatus(id: string, status: string): Promise<BatchedAction | undefined>;

  // Disclosure Proofs
  createDisclosureProof(proof: InsertDisclosureProof, customProofHash?: string): Promise<DisclosureProof>;
  getDisclosureProofs(walletAddress: string): Promise<DisclosureProof[]>;
  revokeDisclosureProof(id: string): Promise<DisclosureProof | undefined>;

  // Activity
  getActivities(walletAddress: string): Promise<Activity[]>;
  addActivity(activity: InsertActivity): Promise<Activity>;

  // Yield Strategies
  createYieldStrategy(strategy: InsertYieldStrategy): Promise<YieldStrategy>;
  getYieldStrategies(walletAddress: string): Promise<YieldStrategy[]>;
  updateYieldStrategy(id: string, updates: Partial<YieldStrategy>): Promise<YieldStrategy | undefined>;

  // Compliance
  createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule>;
  getComplianceRules(walletAddress: string): Promise<ComplianceRule[]>;
  getComplianceRuleById(id: string): Promise<ComplianceRule | undefined>;
  updateComplianceRule(id: string, updates: Partial<ComplianceRule>): Promise<ComplianceRule | undefined>;
  deleteComplianceRule(id: string): Promise<boolean>;

  // Audit Trail
  addAuditEntry(walletAddress: string, eventType: string, description: string, metadata?: any): Promise<AuditTrailEntry>;
  getAuditTrail(walletAddress: string, limit?: number): Promise<AuditTrailEntry[]>;
  exportAuditTrail(walletAddress: string, startDate?: Date, endDate?: Date): Promise<AuditTrailEntry[]>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // ZK Proofs
  createZkProof(proof: InsertZkProof): Promise<ZkProof>;
  getZkProofs(walletAddress: string): Promise<ZkProof[]>;
  getZkProofByNullifier(nullifier: string): Promise<ZkProof | undefined>;
  verifyZkProof(id: string): Promise<ZkProof | undefined>;
  revokeZkProof(id: string): Promise<ZkProof | undefined>;

  // Analytics
  getAnalyticsStats(walletAddress: string, days: number): Promise<AnalyticsStats>;
  getPnLData(walletAddress: string, days: number): Promise<PnLDataPoint[]>;
  getActivityBreakdown(walletAddress: string): Promise<ActivityBreakdown[]>;
  getTradeHistory(walletAddress: string, limit?: number): Promise<TradeRecord[]>;

  // Shadow Balances
  getShadowBalances(walletAddress: string): Promise<ShadowBalanceRecord[]>;
  getShadowBalance(walletAddress: string, tokenMint: string): Promise<ShadowBalanceRecord | undefined>;
  moveToShadow(walletAddress: string, tokenMint: string, tokenSymbol: string, amount: number): Promise<ShadowBalanceRecord>;
  moveFromShadow(walletAddress: string, tokenMint: string, amount: number): Promise<ShadowBalanceRecord | undefined>;

  // Stealth Payments
  createStealthPayment(payment: InsertStealthPayment): Promise<StealthPayment>;
  getStealthPaymentsSent(walletAddress: string): Promise<StealthPayment[]>;
  getStealthPaymentByClaimCode(claimCode: string): Promise<StealthPayment | undefined>;
  claimStealthPayment(claimCode: string, claimerWallet: string, txSignature?: string): Promise<StealthPayment | undefined>;
  cancelStealthPayment(id: string, senderWallet: string): Promise<StealthPayment | undefined>;
  getPendingStealthPayments(): Promise<StealthPayment[]>;

  // Multi-sig Wallets
  createMultisigWallet(wallet: InsertMultisigWallet): Promise<MultisigWallet>;
  getMultisigWallets(walletAddress: string): Promise<MultisigWallet[]>;
  getMultisigWalletById(id: string): Promise<MultisigWallet | undefined>;
  updateMultisigWallet(id: string, updates: Partial<MultisigWallet>): Promise<MultisigWallet | undefined>;
  
  // Multi-sig Members
  addMultisigMember(member: InsertMultisigMember): Promise<MultisigMember>;
  getMultisigMembers(walletId: string): Promise<MultisigMember[]>;
  removeMultisigMember(walletId: string, memberPubkeyHash: string): Promise<boolean>;
  isMemberOfWallet(walletId: string, memberPubkeyHash: string): Promise<boolean>;
  
  // Multi-sig Transactions
  createMultisigTransaction(tx: InsertMultisigTransaction): Promise<MultisigTransaction>;
  getMultisigTransactions(walletId: string): Promise<MultisigTransaction[]>;
  getPendingMultisigTransactions(walletId: string): Promise<MultisigTransaction[]>;
  getMultisigTransactionById(id: string): Promise<MultisigTransaction | undefined>;
  updateMultisigTransaction(id: string, updates: Partial<MultisigTransaction>): Promise<MultisigTransaction | undefined>;
  
  // Multi-sig Approvals (Private)
  addMultisigApproval(approval: InsertMultisigApproval): Promise<MultisigApproval>;
  getMultisigApprovals(transactionId: string): Promise<MultisigApproval[]>;
  hasApproved(transactionId: string, nullifierHash: string): Promise<boolean>;
  getApprovalCount(transactionId: string): Promise<number>;
  
  // Private Routing Layer - Profiles
  getRoutingProfile(walletAddress: string): Promise<RoutingProfile | undefined>;
  createRoutingProfile(profile: InsertRoutingProfile): Promise<RoutingProfile>;
  updateRoutingProfile(walletAddress: string, updates: Partial<RoutingProfile>): Promise<RoutingProfile | undefined>;
  
  // Private Routing Layer - Batches
  createRoutingBatch(batch: InsertRoutingBatch): Promise<RoutingBatch>;
  getRoutingBatch(id: string): Promise<RoutingBatch | undefined>;
  getRoutingBatches(walletAddress: string): Promise<RoutingBatch[]>;
  updateRoutingBatch(id: string, updates: Partial<RoutingBatch>): Promise<RoutingBatch | undefined>;
  
  // Private Routing Layer - Segments
  createRoutingSegment(segment: InsertRoutingSegment): Promise<RoutingSegment>;
  createRoutingSegments(segments: InsertRoutingSegment[]): Promise<RoutingSegment[]>;
  getRoutingSegments(batchId: string): Promise<RoutingSegment[]>;
  updateRoutingSegment(id: string, updates: Partial<RoutingSegment>): Promise<RoutingSegment | undefined>;
  
  // Private Routing Layer - Metrics
  recordRouteMetric(metric: InsertRouteMetric): Promise<RouteMetric>;
  getRouteMetrics(walletAddress: string, limit?: number): Promise<RouteMetric[]>;
  getPrivacyMetricsSummary(walletAddress: string): Promise<{
    averagePrivacyScore: number;
    totalRoutedTransactions: number;
    totalDecoysGenerated: number;
    averageTimingEntropy: number;
    routeDiversityScore: number;
  }>;
  
  // Light Protocol ZK Integration
  getLightProtocolConfig(walletAddress: string): Promise<LightProtocolConfig | undefined>;
  createLightProtocolConfig(config: InsertLightProtocolConfig): Promise<LightProtocolConfig>;
  updateLightProtocolConfig(walletAddress: string, updates: Partial<LightProtocolConfig>): Promise<LightProtocolConfig | undefined>;
  
  // ZK Execution Sessions
  createZkExecutionSession(session: InsertZkExecutionSession): Promise<ZkExecutionSession>;
  getZkExecutionSession(id: string): Promise<ZkExecutionSession | undefined>;
  getZkExecutionSessionByBatch(batchId: string): Promise<ZkExecutionSession | undefined>;
  updateZkExecutionSession(id: string, updates: Partial<ZkExecutionSession>): Promise<ZkExecutionSession | undefined>;
  getZkExecutionSessions(walletAddress: string): Promise<ZkExecutionSession[]>;
  
  // Compressed Notes
  createCompressedNote(note: InsertCompressedNote): Promise<CompressedNote>;
  createCompressedNotes(notes: InsertCompressedNote[]): Promise<CompressedNote[]>;
  getCompressedNotes(walletAddress: string): Promise<CompressedNote[]>;
  getActiveCompressedNotes(walletAddress: string, tokenMint?: string): Promise<CompressedNote[]>;
  markNoteSpent(noteCommitment: string, txSignature: string): Promise<CompressedNote | undefined>;
  getCompressedNoteByCommitment(commitment: string): Promise<CompressedNote | undefined>;
  getCompressedNoteByNullifier(nullifier: string): Promise<CompressedNote | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Portfolio - fetches real data from Solana
  async getPortfolioHoldings(walletAddress: string): Promise<PortfolioHolding[]> {
    if (!walletAddress) {
      return [];
    }

    try {
      const { holdings, prices } = await getWalletTokenData(walletAddress);
      
      if (holdings.length === 0) {
        return [];
      }

      // Get shadow balances from database
      const shadowRecords = await this.getShadowBalances(walletAddress);
      const shadowMap = new Map(shadowRecords.map(s => [s.tokenMint, s.shadowAmount]));

      return holdings.map((h, index) => {
        const shadowAmount = shadowMap.get(h.mint) || 0;
        // Shadow balance cannot exceed total balance
        const actualShadowBalance = Math.min(shadowAmount, h.balance);
        const publicBalance = h.balance - actualShadowBalance;
        
        return {
          id: `${walletAddress}-${h.mint}-${index}`,
          walletAddress,
          tokenMint: h.mint,
          tokenSymbol: h.symbol,
          tokenName: h.name,
          shadowBalance: actualShadowBalance,
          publicBalance: publicBalance,
          valueUsd: h.valueUsd,
          change24h: 0,
        };
      });
    } catch (error) {
      console.error("Error fetching holdings:", error);
      return [];
    }
  }

  private getDefaultHoldings(walletAddress: string): PortfolioHolding[] {
    return [];
  }

  async getDefiPositions(walletAddress: string): Promise<DefiPosition[]> {
    // Get yield strategies from DB and convert to positions
    const strategies = await this.getYieldStrategies(walletAddress);
    
    const positions: DefiPosition[] = strategies.map((s) => ({
      id: s.id,
      walletAddress: s.walletAddress,
      protocol: s.protocol,
      type: s.strategyType as any,
      depositedAmount: s.depositAmount,
      depositedToken: s.depositToken,
      currentValue: s.currentValue,
      apy: s.apy,
      rewards: s.rewards,
      rewardsToken: s.rewardsToken || "",
      isPrivate: s.isPrivate,
    }));

    return positions;
  }

  async getPortfolioStats(walletAddress: string): Promise<PortfolioStats> {
    const holdings = await this.getPortfolioHoldings(walletAddress);
    const positions = await this.getDefiPositions(walletAddress);
    const pendingActions = (await this.getBatchedActions(walletAddress)).filter(
      (a) => a.status === "queued" || a.status === "batching"
    );

    const holdingsValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
    const positionsValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalValue = holdingsValue + positionsValue;

    const shadowValue = holdings.reduce((sum, h) => sum + (h.shadowBalance / (h.shadowBalance + h.publicBalance)) * h.valueUsd, 0);
    const publicValue = holdings.reduce((sum, h) => sum + (h.publicBalance / (h.shadowBalance + h.publicBalance)) * h.valueUsd, 0);

    const privacyScore = totalValue > 0 ? Math.round((shadowValue / totalValue) * 100) : 0;

    return {
      totalValue,
      shadowValue,
      publicValue,
      change24h: 0,
      change24hPercent: 0,
      activePositions: positions.length,
      pendingActions: pendingActions.length,
      privacyScore,
    };
  }

  async savePortfolioSnapshot(walletAddress: string, snapshotData: any): Promise<PortfolioSnapshot> {
    const [snapshot] = await db.insert(portfolioSnapshots).values({
      walletAddress,
      totalValue: snapshotData.totalValue,
      shadowValue: snapshotData.shadowValue,
      publicValue: snapshotData.publicValue,
      holdings: snapshotData.holdings,
    }).returning();
    return snapshot;
  }

  // Swaps
  async createSwapOrder(order: InsertSwapOrder): Promise<SwapOrder> {
    const [swapOrder] = await db.insert(swapOrders).values(order).returning();

    // Create batched action
    await this.createBatchedAction({
      walletAddress: order.walletAddress,
      actionType: "swap",
      description: `Swap ${order.fromAmount} ${MINT_TO_SYMBOL[order.fromToken] || "tokens"} → ${MINT_TO_SYMBOL[order.toToken] || "tokens"}`,
      amount: order.fromAmount,
      token: MINT_TO_SYMBOL[order.fromToken] || order.fromToken,
    });

    // Add audit entry
    await this.addAuditEntry(
      order.walletAddress,
      "swap_initiated",
      `Private swap initiated: ${order.fromAmount} ${MINT_TO_SYMBOL[order.fromToken]} → ${MINT_TO_SYMBOL[order.toToken]}`,
      { orderId: swapOrder.id, fromAmount: order.fromAmount, toAmount: order.toAmount }
    );

    return swapOrder;
  }

  async getSwapOrders(walletAddress: string): Promise<SwapOrder[]> {
    return db.select().from(swapOrders)
      .where(eq(swapOrders.walletAddress, walletAddress))
      .orderBy(desc(swapOrders.createdAt));
  }

  async updateSwapOrderStatus(id: string, status: string, txSignature?: string): Promise<SwapOrder | undefined> {
    const updates: any = { status };
    if (status === "completed") {
      updates.completedAt = new Date();
    }
    if (txSignature) {
      updates.txSignature = txSignature;
    }

    const [order] = await db.update(swapOrders)
      .set(updates)
      .where(eq(swapOrders.id, id))
      .returning();
    return order;
  }

  // Batched Actions
  async createBatchedAction(action: InsertBatchedAction): Promise<BatchedAction> {
    const [batchedAction] = await db.insert(batchedActions).values(action).returning();
    return batchedAction;
  }

  async getBatchedActions(walletAddress: string): Promise<BatchedAction[]> {
    return db.select().from(batchedActions)
      .where(eq(batchedActions.walletAddress, walletAddress))
      .orderBy(desc(batchedActions.createdAt));
  }

  async updateBatchedActionStatus(id: string, status: string, txSignature?: string): Promise<BatchedAction | undefined> {
    const updates: any = { status };
    if (status === "completed") {
      updates.executedAt = new Date();
    }
    if (txSignature) {
      updates.txSignature = txSignature;
    }

    const [action] = await db.update(batchedActions)
      .set(updates)
      .where(eq(batchedActions.id, id))
      .returning();
    return action;
  }

  async executeBatch(walletAddress: string): Promise<{ success: boolean; executed: number }> {
    const queuedActions = await db.select().from(batchedActions)
      .where(and(
        eq(batchedActions.walletAddress, walletAddress),
        eq(batchedActions.status, "queued")
      ));

    let executed = 0;
    for (const action of queuedActions) {
      await this.updateBatchedActionStatus(action.id, "completed");
      executed++;
    }

    await this.addAuditEntry(walletAddress, "batch_executed", `Executed ${executed} batched actions`, { count: executed });

    return { success: true, executed };
  }

  // Disclosure Proofs
  async createDisclosureProof(proof: InsertDisclosureProof, customProofHash?: string): Promise<DisclosureProof> {
    const proofHash = customProofHash || createHash("sha256")
      .update(JSON.stringify({ ...proof, timestamp: Date.now() }))
      .digest("hex");

    const insertData: any = {
      walletAddress: proof.walletAddress,
      proofType: proof.proofType,
      recipientAddress: proof.recipientAddress,
      recipientName: proof.recipientName as string | undefined,
      selectedItems: proof.selectedItems as string[],
      expiresAt: proof.expiresAt,
      proofHash,
    };

    const [disclosureProof] = await db.insert(disclosureProofs).values(insertData).returning();

    // Add audit entry
    await this.addAuditEntry(
      proof.walletAddress,
      "disclosure_created",
      `Disclosure proof created for ${proof.recipientName || proof.recipientAddress}`,
      { proofId: disclosureProof.id, proofType: proof.proofType, items: proof.selectedItems }
    );

    return disclosureProof;
  }

  async getDisclosureProofs(walletAddress: string): Promise<DisclosureProof[]> {
    return db.select().from(disclosureProofs)
      .where(eq(disclosureProofs.walletAddress, walletAddress))
      .orderBy(desc(disclosureProofs.createdAt));
  }

  async revokeDisclosureProof(id: string): Promise<DisclosureProof | undefined> {
    const [proof] = await db.update(disclosureProofs)
      .set({ status: "revoked" })
      .where(eq(disclosureProofs.id, id))
      .returning();

    if (proof) {
      await this.addAuditEntry(
        proof.walletAddress,
        "disclosure_revoked",
        `Disclosure proof revoked`,
        { proofId: id }
      );
    }

    return proof;
  }

  // Activity
  async getActivities(walletAddress: string): Promise<Activity[]> {
    return db.select().from(activities)
      .where(eq(activities.walletAddress, walletAddress))
      .orderBy(desc(activities.timestamp))
      .limit(50);
  }

  async addActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }

  // Yield Strategies
  async createYieldStrategy(strategy: InsertYieldStrategy): Promise<YieldStrategy> {
    const [yieldStrategy] = await db.insert(yieldStrategies).values({
      ...strategy,
      currentValue: strategy.depositAmount,
    }).returning();

    await this.addAuditEntry(
      strategy.walletAddress,
      "yield_strategy_created",
      `Yield strategy created: ${strategy.name} on ${strategy.protocol}`,
      { strategyId: yieldStrategy.id, depositAmount: strategy.depositAmount, apy: strategy.apy }
    );

    return yieldStrategy;
  }

  async getYieldStrategies(walletAddress: string): Promise<YieldStrategy[]> {
    return db.select().from(yieldStrategies)
      .where(eq(yieldStrategies.walletAddress, walletAddress))
      .orderBy(desc(yieldStrategies.createdAt));
  }

  async updateYieldStrategy(id: string, updates: Partial<YieldStrategy>): Promise<YieldStrategy | undefined> {
    const [strategy] = await db.update(yieldStrategies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(yieldStrategies.id, id))
      .returning();
    return strategy;
  }

  // Compliance
  async createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule> {
    const [complianceRule] = await db.insert(complianceRules).values(rule).returning();

    await this.addAuditEntry(
      rule.walletAddress,
      "compliance_rule_created",
      `Compliance rule created: ${rule.name}`,
      { ruleId: complianceRule.id, ruleType: rule.ruleType }
    );

    return complianceRule;
  }

  async getComplianceRules(walletAddress: string): Promise<ComplianceRule[]> {
    return db.select().from(complianceRules)
      .where(eq(complianceRules.walletAddress, walletAddress))
      .orderBy(desc(complianceRules.createdAt));
  }

  async getComplianceRuleById(id: string): Promise<ComplianceRule | undefined> {
    const [rule] = await db.select().from(complianceRules)
      .where(eq(complianceRules.id, id));
    return rule;
  }

  async updateComplianceRule(id: string, updates: Partial<ComplianceRule>): Promise<ComplianceRule | undefined> {
    const [rule] = await db.update(complianceRules)
      .set(updates)
      .where(eq(complianceRules.id, id))
      .returning();
    return rule;
  }

  async deleteComplianceRule(id: string): Promise<boolean> {
    const result = await db.delete(complianceRules).where(eq(complianceRules.id, id));
    return true;
  }

  // Audit Trail
  async addAuditEntry(walletAddress: string, eventType: string, description: string, metadata?: any): Promise<AuditTrailEntry> {
    const proofHash = createHash("sha256")
      .update(JSON.stringify({ walletAddress, eventType, description, metadata, timestamp: Date.now() }))
      .digest("hex");

    const [entry] = await db.insert(auditTrail).values({
      walletAddress,
      eventType,
      description,
      metadata,
      proofHash,
    }).returning();

    return entry;
  }

  async getAuditTrail(walletAddress: string, limit: number = 100): Promise<AuditTrailEntry[]> {
    return db.select().from(auditTrail)
      .where(eq(auditTrail.walletAddress, walletAddress))
      .orderBy(desc(auditTrail.timestamp))
      .limit(limit);
  }

  async exportAuditTrail(walletAddress: string, startDate?: Date, endDate?: Date): Promise<AuditTrailEntry[]> {
    // For now, just return all entries - can add date filtering later
    return this.getAuditTrail(walletAddress, 1000);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // ZK Proofs
  async createZkProof(proof: InsertZkProof): Promise<ZkProof> {
    const insertData = {
      ...proof,
      publicInputs: proof.publicInputs as string[],
    };
    const [zkProof] = await db.insert(zkProofs).values(insertData).returning();

    await this.addAuditEntry(
      proof.walletAddress,
      "zk_proof_generated",
      `Zero-knowledge ${proof.proofType} proof generated`,
      { 
        proofId: zkProof.id, 
        proofType: proof.proofType,
        protocol: proof.protocol,
        commitment: proof.commitment.slice(0, 16) + "...",
      }
    );

    return zkProof;
  }

  async getZkProofs(walletAddress: string): Promise<ZkProof[]> {
    return db.select().from(zkProofs)
      .where(and(
        eq(zkProofs.walletAddress, walletAddress),
        eq(zkProofs.revokedAt, null as any)
      ))
      .orderBy(desc(zkProofs.createdAt));
  }

  async getZkProofByNullifier(nullifier: string): Promise<ZkProof | undefined> {
    const [proof] = await db.select().from(zkProofs)
      .where(eq(zkProofs.nullifier, nullifier));
    return proof;
  }

  async verifyZkProof(id: string): Promise<ZkProof | undefined> {
    const [proof] = await db.update(zkProofs)
      .set({ verified: true })
      .where(eq(zkProofs.id, id))
      .returning();

    if (proof) {
      await this.addAuditEntry(
        proof.walletAddress,
        "zk_proof_verified",
        `Zero-knowledge proof verified`,
        { proofId: id, proofType: proof.proofType }
      );
    }

    return proof;
  }

  async revokeZkProof(id: string): Promise<ZkProof | undefined> {
    const [proof] = await db.update(zkProofs)
      .set({ revokedAt: new Date() })
      .where(eq(zkProofs.id, id))
      .returning();

    if (proof) {
      await this.addAuditEntry(
        proof.walletAddress,
        "zk_proof_revoked",
        `Zero-knowledge proof revoked`,
        { proofId: id, proofType: proof.proofType }
      );
    }

    return proof;
  }

  // Analytics - Real data from swap orders and activities
  async getAnalyticsStats(walletAddress: string, days: number = 30): Promise<AnalyticsStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all swap orders for this wallet
    const orders = await db.select().from(swapOrders)
      .where(eq(swapOrders.walletAddress, walletAddress))
      .orderBy(desc(swapOrders.createdAt));

    // Get activities for this wallet
    const allActivities = await db.select().from(activities)
      .where(eq(activities.walletAddress, walletAddress));

    // Calculate stats from real trade data
    const completedTrades = orders.filter(o => o.status === "completed");
    const totalTrades = completedTrades.length;
    
    // Calculate P&L based on trade values
    // For each swap, we estimate P&L based on the value difference
    let totalPnL = 0;
    let bestTrade = 0;
    let worstTrade = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalVolume = 0;

    for (const trade of completedTrades) {
      // Volume is the from amount (what was sold)
      totalVolume += trade.fromAmount;
      
      // Estimate P&L: difference between what we got vs what we gave
      // This is simplified - in reality we'd need historical prices
      const tradePnL = trade.toAmount - trade.fromAmount; // Simplified calculation
      totalPnL += tradePnL;
      
      if (tradePnL > 0) {
        winningTrades++;
        if (tradePnL > bestTrade) bestTrade = tradePnL;
      } else {
        losingTrades++;
        if (tradePnL < worstTrade) worstTrade = tradePnL;
      }
    }

    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    // Calculate privacy ratio
    const privateOrders = completedTrades.filter(o => o.isPrivate).length;
    const privateRatio = totalTrades > 0 ? (privateOrders / totalTrades) * 100 : 100;

    // Calculate P&L percent based on initial portfolio value
    const holdings = await this.getPortfolioHoldings(walletAddress);
    const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
    const pnlPercent = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;

    return {
      totalPnL,
      pnlPercent,
      totalVolume,
      avgTradeSize,
      winRate,
      totalTrades,
      bestTrade,
      worstTrade,
      privateRatio,
      winningTrades,
      losingTrades,
    };
  }

  async getPnLData(walletAddress: string, days: number = 30): Promise<PnLDataPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all swap orders within the period
    const orders = await db.select().from(swapOrders)
      .where(eq(swapOrders.walletAddress, walletAddress))
      .orderBy(swapOrders.createdAt);

    // Get portfolio snapshots for historical data
    const snapshots = await db.select().from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.walletAddress, walletAddress))
      .orderBy(portfolioSnapshots.timestamp);

    // Group trades by day
    const dataByDate: Map<string, { pnl: number; volume: number; trades: number }> = new Map();
    
    // Initialize all days in the range
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dataByDate.set(dateKey, { pnl: 0, volume: 0, trades: 0 });
    }

    // Populate with real trade data
    for (const order of orders) {
      if (order.status !== "completed" || !order.createdAt) continue;
      
      const date = new Date(order.createdAt);
      const dateKey = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      
      if (dataByDate.has(dateKey)) {
        const current = dataByDate.get(dateKey)!;
        const tradePnL = order.toAmount - order.fromAmount;
        current.pnl += tradePnL;
        current.volume += order.fromAmount;
        current.trades += 1;
        dataByDate.set(dateKey, current);
      }
    }

    // Convert to array with cumulative P&L
    let cumulativePnL = 0;
    const result: PnLDataPoint[] = [];
    
    Array.from(dataByDate.entries()).forEach(([date, data]) => {
      cumulativePnL += data.pnl;
      result.push({
        date,
        pnl: cumulativePnL,
        dailyPnL: data.pnl,
        volume: data.volume,
        trades: data.trades,
      });
    });

    return result;
  }

  async getActivityBreakdown(walletAddress: string): Promise<ActivityBreakdown[]> {
    // Get all activities for this wallet
    const allActivities = await db.select().from(activities)
      .where(eq(activities.walletAddress, walletAddress));

    // Get swap orders
    const orders = await db.select().from(swapOrders)
      .where(eq(swapOrders.walletAddress, walletAddress));

    // Get yield strategies
    const strategies = await db.select().from(yieldStrategies)
      .where(eq(yieldStrategies.walletAddress, walletAddress));

    // Count by type
    const swapCount = orders.filter(o => o.status === "completed").length;
    const stakeCount = strategies.filter(s => s.strategyType === "staking").length;
    const yieldCount = strategies.filter(s => s.strategyType === "farming" || s.strategyType === "lending").length;
    const otherCount = allActivities.filter(a => 
      a.type !== "swap" && a.type !== "stake" && a.type !== "yield"
    ).length;

    const total = swapCount + stakeCount + yieldCount + otherCount || 1;

    const CHART_COLORS = [
      "hsl(195, 100%, 35%)",
      "hsl(170, 100%, 40%)",
      "hsl(45, 100%, 50%)",
      "hsl(280, 70%, 60%)",
    ];

    return [
      { name: "Swaps", value: Math.round((swapCount / total) * 100), count: swapCount, color: CHART_COLORS[0] },
      { name: "Stakes", value: Math.round((stakeCount / total) * 100), count: stakeCount, color: CHART_COLORS[1] },
      { name: "Yields", value: Math.round((yieldCount / total) * 100), count: yieldCount, color: CHART_COLORS[2] },
      { name: "Other", value: Math.round((otherCount / total) * 100), count: otherCount, color: CHART_COLORS[3] },
    ];
  }

  async getTradeHistory(walletAddress: string, limit: number = 20): Promise<TradeRecord[]> {
    const orders = await db.select().from(swapOrders)
      .where(eq(swapOrders.walletAddress, walletAddress))
      .orderBy(desc(swapOrders.createdAt))
      .limit(limit);

    return orders.map(order => {
      const tradePnL = order.toAmount - order.fromAmount;
      const pnlPercent = order.fromAmount > 0 ? (tradePnL / order.fromAmount) * 100 : 0;
      
      return {
        id: order.id,
        date: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Unknown",
        fromToken: order.fromToken,
        toToken: order.toToken,
        fromAmount: order.fromAmount,
        toAmount: order.toAmount,
        valueUsd: order.fromAmount, // Simplified - would need price lookup
        pnl: tradePnL,
        pnlPercent,
        isPrivate: order.isPrivate,
      };
    });
  }

  // Shadow Balance Methods
  async getShadowBalances(walletAddress: string): Promise<ShadowBalanceRecord[]> {
    return db.select().from(shadowBalances)
      .where(eq(shadowBalances.walletAddress, walletAddress))
      .orderBy(desc(shadowBalances.updatedAt));
  }

  async getShadowBalance(walletAddress: string, tokenMint: string): Promise<ShadowBalanceRecord | undefined> {
    const [balance] = await db.select().from(shadowBalances)
      .where(and(
        eq(shadowBalances.walletAddress, walletAddress),
        eq(shadowBalances.tokenMint, tokenMint)
      ));
    return balance;
  }

  async moveToShadow(walletAddress: string, tokenMint: string, tokenSymbol: string, amount: number): Promise<ShadowBalanceRecord> {
    // Check if record exists
    const existing = await this.getShadowBalance(walletAddress, tokenMint);
    
    let result: ShadowBalanceRecord;
    
    if (existing) {
      // Update existing record
      const [updated] = await db.update(shadowBalances)
        .set({ 
          shadowAmount: existing.shadowAmount + amount,
          updatedAt: new Date()
        })
        .where(eq(shadowBalances.id, existing.id))
        .returning();
      result = updated;
    } else {
      // Create new record
      const [created] = await db.insert(shadowBalances).values({
        walletAddress,
        tokenMint,
        tokenSymbol,
        shadowAmount: amount,
      }).returning();
      result = created;
    }

    // Add audit entry
    await this.addAuditEntry(
      walletAddress,
      "shadow_deposit",
      `Moved ${amount} ${tokenSymbol} to shadow balance`,
      { tokenMint, tokenSymbol, amount }
    );

    // Add activity
    await this.addActivity({
      walletAddress,
      type: "shadow_move",
      description: `Shielded ${amount} ${tokenSymbol}`,
      amount,
      token: tokenSymbol,
      valueUsd: 0, // Will be calculated based on price
      isPrivate: true,
      status: "completed",
    });

    return result;
  }

  async moveFromShadow(walletAddress: string, tokenMint: string, amount: number): Promise<ShadowBalanceRecord | undefined> {
    const existing = await this.getShadowBalance(walletAddress, tokenMint);
    
    if (!existing || existing.shadowAmount < amount) {
      return undefined; // Not enough shadow balance
    }

    const newAmount = existing.shadowAmount - amount;
    
    let result: ShadowBalanceRecord;
    
    if (newAmount <= 0) {
      // Delete the record if balance is zero
      await db.delete(shadowBalances).where(eq(shadowBalances.id, existing.id));
      result = { ...existing, shadowAmount: 0 };
    } else {
      // Update the record
      const [updated] = await db.update(shadowBalances)
        .set({ 
          shadowAmount: newAmount,
          updatedAt: new Date()
        })
        .where(eq(shadowBalances.id, existing.id))
        .returning();
      result = updated;
    }

    // Add audit entry
    await this.addAuditEntry(
      walletAddress,
      "shadow_withdraw",
      `Moved ${amount} ${existing.tokenSymbol} from shadow to public`,
      { tokenMint, tokenSymbol: existing.tokenSymbol, amount }
    );

    // Add activity
    await this.addActivity({
      walletAddress,
      type: "shadow_move",
      description: `Unshielded ${amount} ${existing.tokenSymbol}`,
      amount,
      token: existing.tokenSymbol,
      valueUsd: 0,
      isPrivate: false,
      status: "completed",
    });

    return result;
  }

  // Stealth Payments Methods
  async createStealthPayment(payment: InsertStealthPayment): Promise<StealthPayment> {
    const [stealthPayment] = await db.insert(stealthPayments).values(payment).returning();

    // Add audit entry
    await this.addAuditEntry(
      payment.senderWallet,
      "stealth_payment_created",
      `Created stealth payment of ${payment.amount} ${payment.tokenSymbol}`,
      { 
        paymentId: stealthPayment.id, 
        amount: payment.amount, 
        tokenSymbol: payment.tokenSymbol,
        hasRecipientHint: !!payment.recipientHint 
      }
    );

    // Add activity
    await this.addActivity({
      walletAddress: payment.senderWallet,
      type: "stealth_send",
      description: `Stealth payment: ${payment.amount} ${payment.tokenSymbol}`,
      amount: payment.amount,
      token: payment.tokenSymbol,
      valueUsd: payment.valueUsd || 0,
      isPrivate: true,
      status: "completed",
    });

    return stealthPayment;
  }

  async getStealthPaymentsSent(walletAddress: string): Promise<StealthPayment[]> {
    return db.select().from(stealthPayments)
      .where(eq(stealthPayments.senderWallet, walletAddress))
      .orderBy(desc(stealthPayments.createdAt));
  }

  async getStealthPaymentByClaimCode(claimCode: string): Promise<StealthPayment | undefined> {
    const [payment] = await db.select().from(stealthPayments)
      .where(eq(stealthPayments.claimCode, claimCode));
    return payment;
  }

  async claimStealthPayment(claimCode: string, claimerWallet: string, txSignature?: string): Promise<StealthPayment | undefined> {
    // Atomic claim operation - prevents race conditions / double-spend
    // Single UPDATE with status="pending" guard ensures only one claim succeeds
    const updateData: any = { 
      status: "claimed",
      claimedAt: new Date(),
      claimedByWallet: claimerWallet,
    };
    if (txSignature) {
      updateData.txSignature = txSignature;
    }
    
    const [claimed] = await db.update(stealthPayments)
      .set(updateData)
      .where(and(
        eq(stealthPayments.claimCode, claimCode),
        eq(stealthPayments.status, "pending")
      ))
      .returning();

    // If no row was updated, payment doesn't exist or was already claimed/expired
    if (!claimed) {
      // Check if expired and update status if so
      const [payment] = await db.select().from(stealthPayments)
        .where(eq(stealthPayments.claimCode, claimCode));
      
      if (payment && payment.status === "pending" && payment.expiresAt && new Date(payment.expiresAt) < new Date()) {
        await db.update(stealthPayments)
          .set({ status: "expired" })
          .where(eq(stealthPayments.id, payment.id));
      }
      return undefined;
    }

    // Add audit entries for both sender and claimer
    await this.addAuditEntry(
      claimed.senderWallet,
      "stealth_payment_claimed",
      `Stealth payment claimed`,
      { paymentId: claimed.id, claimedBy: claimerWallet.slice(0, 8) + "..." }
    );

    await this.addAuditEntry(
      claimerWallet,
      "stealth_payment_received",
      `Received stealth payment: ${claimed.amount} ${claimed.tokenSymbol}`,
      { paymentId: claimed.id, amount: claimed.amount, tokenSymbol: claimed.tokenSymbol }
    );

    // Add activity for claimer
    await this.addActivity({
      walletAddress: claimerWallet,
      type: "stealth_receive",
      description: `Received stealth payment: ${claimed.amount} ${claimed.tokenSymbol}`,
      amount: claimed.amount,
      token: claimed.tokenSymbol,
      valueUsd: claimed.valueUsd,
      isPrivate: true,
      status: "completed",
    });

    return claimed;
  }

  async cancelStealthPayment(id: string, senderWallet: string): Promise<StealthPayment | undefined> {
    const [payment] = await db.select().from(stealthPayments)
      .where(and(
        eq(stealthPayments.id, id),
        eq(stealthPayments.senderWallet, senderWallet),
        eq(stealthPayments.status, "pending")
      ));

    if (!payment) {
      return undefined;
    }

    const [cancelled] = await db.update(stealthPayments)
      .set({ status: "cancelled" })
      .where(eq(stealthPayments.id, id))
      .returning();

    await this.addAuditEntry(
      senderWallet,
      "stealth_payment_cancelled",
      `Cancelled stealth payment of ${payment.amount} ${payment.tokenSymbol}`,
      { paymentId: id, amount: payment.amount }
    );

    return cancelled;
  }

  async getPendingStealthPayments(): Promise<StealthPayment[]> {
    return db.select().from(stealthPayments)
      .where(eq(stealthPayments.status, "pending"))
      .orderBy(desc(stealthPayments.createdAt));
  }

  // Multi-sig Wallet Methods
  async createMultisigWallet(wallet: InsertMultisigWallet): Promise<MultisigWallet> {
    const [created] = await db.insert(multisigWallets).values(wallet).returning();
    
    await this.addAuditEntry(
      wallet.creatorWallet,
      "multisig_wallet_created",
      `Created multi-sig wallet "${wallet.name}" with ${wallet.threshold}/${wallet.totalMembers} threshold`,
      { walletId: created.id, threshold: wallet.threshold, totalMembers: wallet.totalMembers }
    );
    
    return created;
  }

  async getMultisigWallets(walletAddress: string): Promise<MultisigWallet[]> {
    const memberHashes = await db.select({ walletId: multisigMembers.walletId })
      .from(multisigMembers)
      .where(eq(multisigMembers.status, "active"));
    
    const walletIds = memberHashes.map(m => m.walletId);
    
    const wallets = await db.select().from(multisigWallets)
      .where(eq(multisigWallets.isActive, true))
      .orderBy(desc(multisigWallets.createdAt));
    
    const ownedWallets = wallets.filter(w => w.creatorWallet === walletAddress);
    const memberWallets = wallets.filter(w => walletIds.includes(w.id) && w.creatorWallet !== walletAddress);
    
    return [...ownedWallets, ...memberWallets];
  }

  async getMultisigWalletById(id: string): Promise<MultisigWallet | undefined> {
    const [wallet] = await db.select().from(multisigWallets)
      .where(eq(multisigWallets.id, id));
    return wallet;
  }

  async updateMultisigWallet(id: string, updates: Partial<MultisigWallet>): Promise<MultisigWallet | undefined> {
    const [updated] = await db.update(multisigWallets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(multisigWallets.id, id))
      .returning();
    return updated;
  }

  // Multi-sig Member Methods
  async addMultisigMember(member: InsertMultisigMember): Promise<MultisigMember> {
    const [created] = await db.insert(multisigMembers).values(member).returning();
    return created;
  }

  async getMultisigMembers(walletId: string): Promise<MultisigMember[]> {
    return db.select().from(multisigMembers)
      .where(and(
        eq(multisigMembers.walletId, walletId),
        eq(multisigMembers.status, "active")
      ))
      .orderBy(multisigMembers.addedAt);
  }

  async removeMultisigMember(walletId: string, memberPubkeyHash: string): Promise<boolean> {
    const [updated] = await db.update(multisigMembers)
      .set({ status: "removed" })
      .where(and(
        eq(multisigMembers.walletId, walletId),
        eq(multisigMembers.memberPubkeyHash, memberPubkeyHash)
      ))
      .returning();
    return !!updated;
  }

  async isMemberOfWallet(walletId: string, memberPubkeyHash: string): Promise<boolean> {
    const [member] = await db.select().from(multisigMembers)
      .where(and(
        eq(multisigMembers.walletId, walletId),
        eq(multisigMembers.memberPubkeyHash, memberPubkeyHash),
        eq(multisigMembers.status, "active")
      ));
    return !!member;
  }

  // Multi-sig Transaction Methods
  async createMultisigTransaction(tx: InsertMultisigTransaction): Promise<MultisigTransaction> {
    const [created] = await db.insert(multisigTransactions).values(tx).returning();
    return created;
  }

  async getMultisigTransactions(walletId: string): Promise<MultisigTransaction[]> {
    return db.select().from(multisigTransactions)
      .where(eq(multisigTransactions.walletId, walletId))
      .orderBy(desc(multisigTransactions.createdAt));
  }

  async getPendingMultisigTransactions(walletId: string): Promise<MultisigTransaction[]> {
    return db.select().from(multisigTransactions)
      .where(and(
        eq(multisigTransactions.walletId, walletId),
        eq(multisigTransactions.status, "pending")
      ))
      .orderBy(desc(multisigTransactions.createdAt));
  }

  async getMultisigTransactionById(id: string): Promise<MultisigTransaction | undefined> {
    const [tx] = await db.select().from(multisigTransactions)
      .where(eq(multisigTransactions.id, id));
    return tx;
  }

  async updateMultisigTransaction(id: string, updates: Partial<MultisigTransaction>): Promise<MultisigTransaction | undefined> {
    const [updated] = await db.update(multisigTransactions)
      .set(updates)
      .where(eq(multisigTransactions.id, id))
      .returning();
    return updated;
  }

  // Multi-sig Approval Methods (Private)
  async addMultisigApproval(approval: InsertMultisigApproval): Promise<MultisigApproval> {
    const [created] = await db.insert(multisigApprovals).values(approval).returning();
    
    const tx = await this.getMultisigTransactionById(approval.transactionId);
    if (tx) {
      const newCount = tx.approvalCount + 1;
      const newStatus = newCount >= tx.requiredApprovals ? "approved" : "pending";
      await this.updateMultisigTransaction(tx.id, { 
        approvalCount: newCount,
        status: newStatus
      });
    }
    
    return created;
  }

  async getMultisigApprovals(transactionId: string): Promise<MultisigApproval[]> {
    return db.select().from(multisigApprovals)
      .where(eq(multisigApprovals.transactionId, transactionId))
      .orderBy(multisigApprovals.approvedAt);
  }

  async hasApproved(transactionId: string, nullifierHash: string): Promise<boolean> {
    const [existing] = await db.select().from(multisigApprovals)
      .where(eq(multisigApprovals.nullifierHash, nullifierHash));
    return !!existing;
  }

  async getApprovalCount(transactionId: string): Promise<number> {
    const approvals = await db.select().from(multisigApprovals)
      .where(eq(multisigApprovals.transactionId, transactionId));
    return approvals.length;
  }

  // ============================================
  // PRIVATE ROUTING LAYER METHODS
  // ============================================

  // Routing Profiles
  async getRoutingProfile(walletAddress: string): Promise<RoutingProfile | undefined> {
    const [profile] = await db.select().from(routingProfiles)
      .where(eq(routingProfiles.walletAddress, walletAddress));
    return profile;
  }

  async createRoutingProfile(profile: InsertRoutingProfile): Promise<RoutingProfile> {
    const [created] = await db.insert(routingProfiles).values(profile).returning();
    
    await this.addAuditEntry(
      profile.walletAddress,
      "routing_profile_created",
      `Private routing profile created with privacy level: ${profile.privacyLevel || "enhanced"}`,
      { profileId: created.id, privacyLevel: profile.privacyLevel }
    );
    
    return created;
  }

  async updateRoutingProfile(walletAddress: string, updates: Partial<RoutingProfile>): Promise<RoutingProfile | undefined> {
    const [updated] = await db.update(routingProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(routingProfiles.walletAddress, walletAddress))
      .returning();
    
    if (updated) {
      await this.addAuditEntry(
        walletAddress,
        "routing_profile_updated",
        `Private routing profile settings updated`,
        { updatedFields: Object.keys(updates) }
      );
    }
    
    return updated;
  }

  // Routing Batches
  async createRoutingBatch(batch: InsertRoutingBatch): Promise<RoutingBatch> {
    const [created] = await db.insert(routingBatches).values(batch).returning();
    
    await this.addAuditEntry(
      batch.walletAddress,
      "routing_batch_created",
      `Privacy-enhanced routing batch created`,
      { batchId: created.id }
    );
    
    return created;
  }

  async getRoutingBatch(id: string): Promise<RoutingBatch | undefined> {
    const [batch] = await db.select().from(routingBatches)
      .where(eq(routingBatches.id, id));
    return batch;
  }

  async getRoutingBatches(walletAddress: string): Promise<RoutingBatch[]> {
    return db.select().from(routingBatches)
      .where(eq(routingBatches.walletAddress, walletAddress))
      .orderBy(desc(routingBatches.createdAt))
      .limit(50);
  }

  async updateRoutingBatch(id: string, updates: Partial<RoutingBatch>): Promise<RoutingBatch | undefined> {
    const [updated] = await db.update(routingBatches)
      .set(updates)
      .where(eq(routingBatches.id, id))
      .returning();
    return updated;
  }

  // Routing Segments
  async createRoutingSegment(segment: InsertRoutingSegment): Promise<RoutingSegment> {
    const [created] = await db.insert(routingSegments).values(segment).returning();
    return created;
  }

  async createRoutingSegments(segments: InsertRoutingSegment[]): Promise<RoutingSegment[]> {
    if (segments.length === 0) return [];
    const created = await db.insert(routingSegments).values(segments).returning();
    return created;
  }

  async getRoutingSegments(batchId: string): Promise<RoutingSegment[]> {
    return db.select().from(routingSegments)
      .where(eq(routingSegments.batchId, batchId))
      .orderBy(routingSegments.segmentIndex);
  }

  async updateRoutingSegment(id: string, updates: Partial<RoutingSegment>): Promise<RoutingSegment | undefined> {
    const [updated] = await db.update(routingSegments)
      .set(updates)
      .where(eq(routingSegments.id, id))
      .returning();
    return updated;
  }

  // Route Metrics
  async recordRouteMetric(metric: InsertRouteMetric): Promise<RouteMetric> {
    const [created] = await db.insert(routeMetrics).values(metric).returning();
    return created;
  }

  async getRouteMetrics(walletAddress: string, limit: number = 100): Promise<RouteMetric[]> {
    return db.select().from(routeMetrics)
      .where(eq(routeMetrics.walletAddress, walletAddress))
      .orderBy(desc(routeMetrics.recordedAt))
      .limit(limit);
  }

  async getPrivacyMetricsSummary(walletAddress: string): Promise<{
    averagePrivacyScore: number;
    totalRoutedTransactions: number;
    totalDecoysGenerated: number;
    averageTimingEntropy: number;
    routeDiversityScore: number;
  }> {
    const batches = await db.select().from(routingBatches)
      .where(eq(routingBatches.walletAddress, walletAddress));
    
    const metrics = await db.select().from(routeMetrics)
      .where(eq(routeMetrics.walletAddress, walletAddress));
    
    const completedBatches = batches.filter(b => b.status === "completed");
    const totalRoutedTransactions = completedBatches.length;
    
    const totalDecoysGenerated = batches.reduce((sum, b) => {
      const decoyCount = b.routeMetadata?.decoyCount || 0;
      return sum + decoyCount;
    }, 0);
    
    const avgPrivacyScore = completedBatches.length > 0
      ? completedBatches.reduce((sum, b) => sum + b.privacyScore, 0) / completedBatches.length
      : 0;
    
    const avgTimingEntropy = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.timingEntropy || 0), 0) / metrics.length
      : 0;
    
    const avgRouteDiversity = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.routeDiversity || 0), 0) / metrics.length
      : 0;
    
    return {
      averagePrivacyScore: Math.round(avgPrivacyScore * 10) / 10,
      totalRoutedTransactions,
      totalDecoysGenerated,
      averageTimingEntropy: Math.round(avgTimingEntropy * 100) / 100,
      routeDiversityScore: Math.round(avgRouteDiversity * 100) / 100,
    };
  }

  // ============================================
  // LIGHT PROTOCOL ZK INTEGRATION
  // ============================================

  async getLightProtocolConfig(walletAddress: string): Promise<LightProtocolConfig | undefined> {
    const [config] = await db.select().from(lightProtocolConfig)
      .where(eq(lightProtocolConfig.walletAddress, walletAddress));
    return config;
  }

  async createLightProtocolConfig(config: InsertLightProtocolConfig): Promise<LightProtocolConfig> {
    const [created] = await db.insert(lightProtocolConfig).values(config).returning();
    
    await this.addAuditEntry(
      config.walletAddress,
      "zk_config_created",
      `Light Protocol ZK configuration created`,
      { zkMode: config.zkMode || "simulator" }
    );
    
    return created;
  }

  async updateLightProtocolConfig(walletAddress: string, updates: Partial<LightProtocolConfig>): Promise<LightProtocolConfig | undefined> {
    const [updated] = await db.update(lightProtocolConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(lightProtocolConfig.walletAddress, walletAddress))
      .returning();
    
    if (updated && updates.zkMode) {
      await this.addAuditEntry(
        walletAddress,
        "zk_mode_changed",
        `ZK execution mode changed to ${updates.zkMode}`,
        { newMode: updates.zkMode }
      );
    }
    
    return updated;
  }

  // ZK Execution Sessions
  async createZkExecutionSession(session: InsertZkExecutionSession): Promise<ZkExecutionSession> {
    const [created] = await db.insert(zkExecutionSessions).values(session).returning();
    
    await this.addAuditEntry(
      session.walletAddress,
      "zk_session_created",
      `ZK execution session started for batch ${session.batchId}`,
      { sessionId: created.id, batchId: session.batchId }
    );
    
    return created;
  }

  async getZkExecutionSession(id: string): Promise<ZkExecutionSession | undefined> {
    const [session] = await db.select().from(zkExecutionSessions)
      .where(eq(zkExecutionSessions.id, id));
    return session;
  }

  async getZkExecutionSessionByBatch(batchId: string): Promise<ZkExecutionSession | undefined> {
    const [session] = await db.select().from(zkExecutionSessions)
      .where(eq(zkExecutionSessions.batchId, batchId));
    return session;
  }

  async updateZkExecutionSession(id: string, updates: Partial<ZkExecutionSession>): Promise<ZkExecutionSession | undefined> {
    const [updated] = await db.update(zkExecutionSessions)
      .set(updates)
      .where(eq(zkExecutionSessions.id, id))
      .returning();
    return updated;
  }

  async getZkExecutionSessions(walletAddress: string): Promise<ZkExecutionSession[]> {
    return db.select().from(zkExecutionSessions)
      .where(eq(zkExecutionSessions.walletAddress, walletAddress))
      .orderBy(desc(zkExecutionSessions.createdAt))
      .limit(50);
  }

  // Compressed Notes
  async createCompressedNote(note: InsertCompressedNote): Promise<CompressedNote> {
    const [created] = await db.insert(compressedNotes).values(note).returning();
    return created;
  }

  async createCompressedNotes(notes: InsertCompressedNote[]): Promise<CompressedNote[]> {
    if (notes.length === 0) return [];
    const created = await db.insert(compressedNotes).values(notes).returning();
    return created;
  }

  async getCompressedNotes(walletAddress: string): Promise<CompressedNote[]> {
    return db.select().from(compressedNotes)
      .where(eq(compressedNotes.walletAddress, walletAddress))
      .orderBy(desc(compressedNotes.createdAt))
      .limit(100);
  }

  async getActiveCompressedNotes(walletAddress: string, tokenMint?: string): Promise<CompressedNote[]> {
    let query = db.select().from(compressedNotes)
      .where(
        and(
          eq(compressedNotes.walletAddress, walletAddress),
          eq(compressedNotes.status, "active")
        )
      );
    
    const results = await query.orderBy(desc(compressedNotes.createdAt));
    
    if (tokenMint) {
      return results.filter(note => note.tokenMint === tokenMint);
    }
    return results;
  }

  async markNoteSpent(noteCommitment: string, txSignature: string): Promise<CompressedNote | undefined> {
    const [updated] = await db.update(compressedNotes)
      .set({ 
        status: "spent", 
        spentAt: new Date(),
        spentInTxSignature: txSignature 
      })
      .where(eq(compressedNotes.noteCommitment, noteCommitment))
      .returning();
    return updated;
  }

  async getCompressedNoteByCommitment(commitment: string): Promise<CompressedNote | undefined> {
    const [note] = await db.select().from(compressedNotes)
      .where(eq(compressedNotes.noteCommitment, commitment));
    return note;
  }

  async getCompressedNoteByNullifier(nullifier: string): Promise<CompressedNote | undefined> {
    const [note] = await db.select().from(compressedNotes)
      .where(eq(compressedNotes.nullifierHash, nullifier));
    return note;
  }
}

export const storage = new DatabaseStorage();
