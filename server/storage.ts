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
  type InsertSwapOrder,
  type InsertBatchedAction,
  type InsertDisclosureProof,
  type InsertActivity,
  type InsertYieldStrategy,
  type InsertComplianceRule,
  type InsertUser,
  type InsertZkProof,
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
  createDisclosureProof(proof: InsertDisclosureProof): Promise<DisclosureProof>;
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

      return holdings.map((h, index) => ({
        id: `${walletAddress}-${h.mint}-${index}`,
        walletAddress,
        tokenMint: h.mint,
        tokenSymbol: h.symbol,
        tokenName: h.name,
        shadowBalance: h.balance,
        publicBalance: h.balance,
        valueUsd: h.valueUsd,
        change24h: 0,
      }));
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
  async createDisclosureProof(proof: InsertDisclosureProof): Promise<DisclosureProof> {
    const proofHash = createHash("sha256")
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
}

export const storage = new DatabaseStorage();
