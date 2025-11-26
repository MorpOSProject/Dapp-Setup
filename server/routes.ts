import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertSwapOrderSchema, 
  insertBatchedActionSchema, 
  insertDisclosureProofSchema,
  insertYieldStrategySchema,
  insertComplianceRuleSchema,
} from "@shared/schema";
import { z } from "zod";
import { 
  getJupiterQuote, 
  getJupiterSwapTransaction, 
  confirmTransaction,
  TOKEN_MINTS, 
  MINT_TO_SYMBOL, 
  getTokenPrices,
  connection
} from "./solana";
import { zkProofService } from "./zk-proof";
import { yieldProtocolsService } from "./yield-protocols";

export async function registerRoutes(app: Express): Promise<Server> {
  // Portfolio Stats
  app.get("/api/portfolio/stats", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const stats = await storage.getPortfolioStats(walletAddress);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching portfolio stats:", error);
      res.status(500).json({ error: "Failed to fetch portfolio stats" });
    }
  });

  // Portfolio Holdings
  app.get("/api/portfolio/holdings", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const holdings = await storage.getPortfolioHoldings(walletAddress);
      res.json(holdings);
    } catch (error) {
      console.error("Error fetching portfolio holdings:", error);
      res.status(500).json({ error: "Failed to fetch portfolio holdings" });
    }
  });

  // DeFi Positions
  app.get("/api/portfolio/positions", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const positions = await storage.getDefiPositions(walletAddress);
      res.json(positions);
    } catch (error) {
      console.error("Error fetching DeFi positions:", error);
      res.status(500).json({ error: "Failed to fetch DeFi positions" });
    }
  });

  // Activity
  app.get("/api/activity", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const activities = await storage.getActivities(walletAddress);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // Batched Actions
  app.get("/api/batched-actions", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const actions = await storage.getBatchedActions(walletAddress);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching batched actions:", error);
      res.status(500).json({ error: "Failed to fetch batched actions" });
    }
  });

  // Create Batched Action
  app.post("/api/batched-actions", async (req, res) => {
    try {
      const validatedData = insertBatchedActionSchema.parse(req.body);
      const action = await storage.createBatchedAction(validatedData);
      res.status(201).json(action);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid batched action data", details: error.errors });
      } else {
        console.error("Error creating batched action:", error);
        res.status(500).json({ error: "Failed to create batched action" });
      }
    }
  });

  // Update Batched Action Status
  app.patch("/api/batched-actions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, txSignature } = req.body;
      
      if (!status) {
        res.status(400).json({ error: "Missing status" });
        return;
      }
      
      const action = await storage.updateBatchedActionStatus(id, status, txSignature);
      if (!action) {
        res.status(404).json({ error: "Batched action not found" });
        return;
      }
      
      // Add activity for completed actions
      if (status === "completed" && action.metadata) {
        const metadata = action.metadata as any;
        await storage.addActivity({
          walletAddress: action.walletAddress,
          type: action.actionType,
          description: action.description,
          amount: action.amount,
          token: action.token,
          valueUsd: action.amount * 200, // Approximate
          isPrivate: true,
          status: "completed",
          txSignature,
        });
      }
      
      res.json(action);
    } catch (error) {
      console.error("Error updating batched action:", error);
      res.status(500).json({ error: "Failed to update batched action" });
    }
  });

  // Execute Batch Now (legacy - marks all as completed)
  app.post("/api/batched-actions/execute", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      if (!walletAddress) {
        res.status(400).json({ error: "Missing wallet address" });
        return;
      }
      const result = await storage.executeBatch(walletAddress);
      res.json(result);
    } catch (error) {
      console.error("Error executing batch:", error);
      res.status(500).json({ error: "Failed to execute batch" });
    }
  });

  // Jupiter Quote
  app.get("/api/swap/quote", async (req, res) => {
    try {
      const { inputMint, outputMint, amount, slippage } = req.query;
      
      if (!inputMint || !outputMint || !amount) {
        res.status(400).json({ error: "Missing required parameters" });
        return;
      }

      const inputTokenInfo = Object.values(TOKEN_MINTS).find(t => t.mint === inputMint);
      const decimals = inputTokenInfo?.decimals || 9;
      // Convert slippage percentage to basis points (0.5% -> 50 bps)
      // Minimum 50 bps (0.5%) to avoid slippage failures
      const slippageBps = slippage ? Math.max(Math.round(parseFloat(slippage as string) * 100), 50) : 50;

      const quote = await getJupiterQuote(
        inputMint as string,
        outputMint as string,
        parseFloat(amount as string),
        decimals,
        slippageBps
      );

      if (!quote) {
        res.status(503).json({ error: "Failed to get quote from Jupiter" });
        return;
      }

      res.json(quote);
    } catch (error) {
      console.error("Error fetching Jupiter quote:", error);
      res.status(500).json({ error: "Failed to fetch swap quote" });
    }
  });

  // Get Jupiter Swap Transaction (for wallet signing)
  app.post("/api/swap/transaction", async (req, res) => {
    try {
      const { quoteResponse, userPublicKey } = req.body;
      
      if (!quoteResponse || !userPublicKey) {
        res.status(400).json({ error: "Missing quote response or user public key" });
        return;
      }

      const transaction = await getJupiterSwapTransaction(quoteResponse, userPublicKey);
      
      if (!transaction) {
        res.status(503).json({ error: "Failed to get swap transaction from Jupiter" });
        return;
      }

      res.json(transaction);
    } catch (error) {
      console.error("Error getting swap transaction:", error);
      res.status(500).json({ error: "Failed to get swap transaction" });
    }
  });

  // Send signed transaction through backend (uses Tatum RPC)
  app.post("/api/swap/send", async (req, res) => {
    try {
      const { signedTransaction, lastValidBlockHeight } = req.body;
      
      if (!signedTransaction) {
        res.status(400).json({ error: "Missing signed transaction" });
        return;
      }

      console.log("Sending signed transaction through backend RPC...");
      
      // Decode the base64 signed transaction
      const rawTransaction = Buffer.from(signedTransaction, "base64");
      
      // Send the transaction using our Tatum-configured connection
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      
      console.log("Transaction sent, signature:", signature);

      // Confirm the transaction
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: req.body.blockhash,
          lastValidBlockHeight: lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        console.error("Transaction failed on-chain:", confirmation.value.err);
        res.status(400).json({ 
          error: "Transaction failed on-chain", 
          details: confirmation.value.err 
        });
        return;
      }

      console.log("Transaction confirmed successfully");
      res.json({ 
        signature, 
        confirmed: true,
        slot: confirmation.context.slot 
      });
    } catch (error: any) {
      console.error("Error sending transaction:", error);
      res.status(500).json({ 
        error: "Failed to send transaction", 
        details: error.message || String(error)
      });
    }
  });

  // Confirm Transaction
  app.post("/api/swap/confirm", async (req, res) => {
    try {
      const { signature, swapOrderId } = req.body;
      
      if (!signature) {
        res.status(400).json({ error: "Missing transaction signature" });
        return;
      }

      const result = await confirmTransaction(signature);
      
      // Update swap order status if provided
      if (swapOrderId && result.confirmed) {
        await storage.updateSwapOrderStatus(swapOrderId, "confirmed", signature);
      }

      res.json(result);
    } catch (error) {
      console.error("Error confirming transaction:", error);
      res.status(500).json({ error: "Failed to confirm transaction" });
    }
  });

  // Create Swap Order
  app.post("/api/swap", async (req, res) => {
    try {
      const validatedData = insertSwapOrderSchema.parse(req.body);
      const swapOrder = await storage.createSwapOrder(validatedData);
      
      // Add activity
      await storage.addActivity({
        walletAddress: validatedData.walletAddress,
        type: "swap",
        description: `Private swap: ${MINT_TO_SYMBOL[validatedData.fromToken] || "tokens"} → ${MINT_TO_SYMBOL[validatedData.toToken] || "tokens"}`,
        amount: validatedData.fromAmount,
        token: MINT_TO_SYMBOL[validatedData.fromToken] || validatedData.fromToken,
        valueUsd: validatedData.fromAmount * 200, // Approximate
        isPrivate: validatedData.isPrivate,
        status: "pending",
      });

      res.status(201).json(swapOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid swap order data", details: error.errors });
      } else {
        console.error("Error creating swap order:", error);
        res.status(500).json({ error: "Failed to create swap order" });
      }
    }
  });

  // Get Swap Orders
  app.get("/api/swap/orders", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const orders = await storage.getSwapOrders(walletAddress);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching swap orders:", error);
      res.status(500).json({ error: "Failed to fetch swap orders" });
    }
  });

  // Disclosure Proofs
  app.get("/api/disclosure/proofs", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const proofs = await storage.getDisclosureProofs(walletAddress);
      res.json(proofs);
    } catch (error) {
      console.error("Error fetching disclosure proofs:", error);
      res.status(500).json({ error: "Failed to fetch disclosure proofs" });
    }
  });

  app.post("/api/disclosure/create", async (req, res) => {
    try {
      const validatedData = insertDisclosureProofSchema.parse(req.body);
      const proof = await storage.createDisclosureProof(validatedData);
      res.status(201).json(proof);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid disclosure proof data", details: error.errors });
      } else {
        console.error("Error creating disclosure proof:", error);
        res.status(500).json({ error: "Failed to create disclosure proof" });
      }
    }
  });

  app.post("/api/disclosure/revoke/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const proof = await storage.revokeDisclosureProof(id);
      if (!proof) {
        res.status(404).json({ error: "Proof not found" });
        return;
      }
      res.json(proof);
    } catch (error) {
      console.error("Error revoking disclosure proof:", error);
      res.status(500).json({ error: "Failed to revoke disclosure proof" });
    }
  });

  // Yield Protocol Endpoints - Real Protocol Data
  app.get("/api/yield/protocols", async (_req, res) => {
    try {
      const protocols = await yieldProtocolsService.getAllProtocols();
      res.json(protocols);
    } catch (error) {
      console.error("Error fetching yield protocols:", error);
      res.status(500).json({ error: "Failed to fetch yield protocols" });
    }
  });

  app.get("/api/yield/pools", async (_req, res) => {
    try {
      const pools = await yieldProtocolsService.getAllPools();
      res.json(pools);
    } catch (error) {
      console.error("Error fetching yield pools:", error);
      res.status(500).json({ error: "Failed to fetch yield pools" });
    }
  });

  app.get("/api/yield/marinade", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const marinadeInfo = await yieldProtocolsService.getMarinadeInfo();
      
      let msolBalance = 0;
      if (walletAddress) {
        msolBalance = await yieldProtocolsService.getMsolBalance(walletAddress);
      }
      
      if (!marinadeInfo.stats && !marinadeInfo.chainState) {
        res.status(503).json({ 
          error: "Marinade data unavailable",
          message: "Unable to fetch real-time data from Marinade protocol. Please try again later."
        });
        return;
      }
      
      res.json({
        stats: marinadeInfo.stats,
        chainState: marinadeInfo.chainState,
        msolBalance,
        dataSource: marinadeInfo.stats?.dataSource || "chain",
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching Marinade info:", error);
      res.status(500).json({ error: "Failed to fetch Marinade info" });
    }
  });

  app.post("/api/yield/marinade/stake", async (req, res) => {
    try {
      const { walletAddress, amount } = req.body;
      
      if (!walletAddress || !amount || amount <= 0) {
        res.status(400).json({ error: "Invalid request parameters" });
        return;
      }
      
      const result = await yieldProtocolsService.buildMarinadeStakeTransaction(walletAddress, amount);
      
      if (!result) {
        res.status(500).json({ error: "Failed to build stake transaction" });
        return;
      }
      
      // Store as pending yield strategy
      const strategy = await storage.createYieldStrategy({
        walletAddress,
        protocolId: "marinade",
        name: "Marinade SOL Staking",
        strategyType: "staking",
        tokens: ["SOL", "mSOL"],
        allocations: [amount],
        expectedApy: 6.5,
        riskLevel: "low",
        status: "pending",
      });
      
      // Add to audit trail
      await storage.addAuditEntry(
        walletAddress,
        "yield_stake_initiated",
        `Initiated Marinade stake: ${amount} SOL → ~${result.msolAmount.toFixed(4)} mSOL`,
        { strategyId: strategy.id, amount, expectedMsol: result.msolAmount }
      );
      
      res.json({
        success: true,
        strategyId: strategy.id,
        expectedMsol: result.msolAmount,
        message: "Stake transaction prepared - sign with wallet to complete",
      });
    } catch (error) {
      console.error("Error initiating Marinade stake:", error);
      res.status(500).json({ error: "Failed to initiate stake" });
    }
  });

  app.post("/api/yield/marinade/unstake", async (req, res) => {
    try {
      const { walletAddress, amount, instant = true } = req.body;
      
      if (!walletAddress || !amount || amount <= 0) {
        res.status(400).json({ error: "Invalid request parameters" });
        return;
      }
      
      const result = await yieldProtocolsService.buildMarinadeUnstakeTransaction(walletAddress, amount, instant);
      
      if (!result) {
        res.status(500).json({ error: "Failed to build unstake transaction" });
        return;
      }
      
      // Add to audit trail
      await storage.addAuditEntry(
        walletAddress,
        "yield_unstake_initiated",
        `Initiated Marinade unstake: ${amount} mSOL → ~${result.solAmount.toFixed(4)} SOL${instant ? " (instant)" : " (delayed)"}`,
        { amount, expectedSol: result.solAmount, instant }
      );
      
      res.json({
        success: true,
        expectedSol: result.solAmount,
        instant,
        message: instant 
          ? "Instant unstake prepared - sign with wallet to complete" 
          : "Delayed unstake prepared - takes 2-3 epochs",
      });
    } catch (error) {
      console.error("Error initiating Marinade unstake:", error);
      res.status(500).json({ error: "Failed to initiate unstake" });
    }
  });

  // Yield Strategies (User's saved strategies)
  app.get("/api/yield/strategies", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const strategies = await storage.getYieldStrategies(walletAddress);
      res.json(strategies);
    } catch (error) {
      console.error("Error fetching yield strategies:", error);
      res.status(500).json({ error: "Failed to fetch yield strategies" });
    }
  });

  app.post("/api/yield/strategies", async (req, res) => {
    try {
      const validatedData = insertYieldStrategySchema.parse(req.body);
      const strategy = await storage.createYieldStrategy(validatedData);
      
      // Add activity
      await storage.addActivity({
        walletAddress: validatedData.walletAddress,
        type: "deposit",
        description: `Created yield strategy: ${validatedData.name}`,
        amount: validatedData.depositAmount,
        token: validatedData.depositToken,
        valueUsd: validatedData.depositAmount * 1, // Estimate
        isPrivate: validatedData.isPrivate,
        status: "completed",
      });

      res.status(201).json(strategy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid strategy data", details: error.errors });
      } else {
        console.error("Error creating yield strategy:", error);
        res.status(500).json({ error: "Failed to create yield strategy" });
      }
    }
  });

  app.patch("/api/yield/strategies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const strategy = await storage.updateYieldStrategy(id, req.body);
      if (!strategy) {
        res.status(404).json({ error: "Strategy not found" });
        return;
      }
      res.json(strategy);
    } catch (error) {
      console.error("Error updating yield strategy:", error);
      res.status(500).json({ error: "Failed to update yield strategy" });
    }
  });

  // Compliance Rules
  app.get("/api/compliance/rules", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const rules = await storage.getComplianceRules(walletAddress);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching compliance rules:", error);
      res.status(500).json({ error: "Failed to fetch compliance rules" });
    }
  });

  app.post("/api/compliance/rules", async (req, res) => {
    try {
      const validatedData = insertComplianceRuleSchema.parse(req.body);
      const rule = await storage.createComplianceRule(validatedData);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid rule data", details: error.errors });
      } else {
        console.error("Error creating compliance rule:", error);
        res.status(500).json({ error: "Failed to create compliance rule" });
      }
    }
  });

  app.patch("/api/compliance/rules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.updateComplianceRule(id, req.body);
      if (!rule) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }
      res.json(rule);
    } catch (error) {
      console.error("Error updating compliance rule:", error);
      res.status(500).json({ error: "Failed to update compliance rule" });
    }
  });

  app.delete("/api/compliance/rules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteComplianceRule(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting compliance rule:", error);
      res.status(500).json({ error: "Failed to delete compliance rule" });
    }
  });

  // Audit Trail
  app.get("/api/audit/trail", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const limit = parseInt(req.query.limit as string) || 100;
      const trail = await storage.getAuditTrail(walletAddress, limit);
      res.json(trail);
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ error: "Failed to fetch audit trail" });
    }
  });

  app.get("/api/audit/export", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const trail = await storage.exportAuditTrail(walletAddress);
      
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=audit-trail-${walletAddress.slice(0, 8)}.json`);
      res.json(trail);
    } catch (error) {
      console.error("Error exporting audit trail:", error);
      res.status(500).json({ error: "Failed to export audit trail" });
    }
  });

  // Analytics API endpoints
  app.get("/api/analytics/stats", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const days = parseInt(req.query.days as string) || 30;
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address required" });
        return;
      }

      const stats = await storage.getAnalyticsStats(walletAddress, days);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching analytics stats:", error);
      res.status(500).json({ error: "Failed to fetch analytics stats" });
    }
  });

  app.get("/api/analytics/pnl", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const days = parseInt(req.query.days as string) || 30;
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address required" });
        return;
      }

      const pnlData = await storage.getPnLData(walletAddress, days);
      res.json(pnlData);
    } catch (error) {
      console.error("Error fetching P&L data:", error);
      res.status(500).json({ error: "Failed to fetch P&L data" });
    }
  });

  app.get("/api/analytics/volume", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const days = parseInt(req.query.days as string) || 30;
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address required" });
        return;
      }

      // Volume data is included in PnL data
      const pnlData = await storage.getPnLData(walletAddress, days);
      res.json(pnlData.map(d => ({ date: d.date, volume: d.volume, trades: d.trades })));
    } catch (error) {
      console.error("Error fetching volume data:", error);
      res.status(500).json({ error: "Failed to fetch volume data" });
    }
  });

  app.get("/api/analytics/activity-breakdown", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address required" });
        return;
      }

      const breakdown = await storage.getActivityBreakdown(walletAddress);
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching activity breakdown:", error);
      res.status(500).json({ error: "Failed to fetch activity breakdown" });
    }
  });

  app.get("/api/analytics/trades", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address required" });
        return;
      }

      const trades = await storage.getTradeHistory(walletAddress, limit);
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trade history:", error);
      res.status(500).json({ error: "Failed to fetch trade history" });
    }
  });

  // Token prices
  app.get("/api/tokens/prices", async (_req, res) => {
    try {
      const mints = Object.values(TOKEN_MINTS).map(t => t.mint);
      const prices = await getTokenPrices(mints);
      
      const priceData: Record<string, { symbol: string; price: number; change24h: number }> = {};
      for (const [symbol, tokenInfo] of Object.entries(TOKEN_MINTS)) {
        const price = prices.get(tokenInfo.mint) || 0;
        priceData[tokenInfo.mint] = {
          symbol,
          price,
          change24h: (Math.random() * 10 - 5), // Simulated for now
        };
      }

      res.json(priceData);
    } catch (error) {
      console.error("Error fetching token prices:", error);
      res.status(500).json({ error: "Failed to fetch token prices" });
    }
  });

  // Supported tokens list
  app.get("/api/tokens", async (_req, res) => {
    try {
      res.json(TOKEN_MINTS);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      res.status(500).json({ error: "Failed to fetch tokens" });
    }
  });

  // ZK Proof Generation
  app.post("/api/zk/generate/balance", async (req, res) => {
    try {
      const { walletAddress, balance, tokenSymbol, threshold } = req.body;
      
      if (!walletAddress || balance === undefined || !tokenSymbol) {
        res.status(400).json({ error: "Missing required parameters" });
        return;
      }

      const zkProof = await zkProofService.generateBalanceProof(
        walletAddress,
        balance,
        tokenSymbol,
        threshold
      );

      // Check nullifier uniqueness before storing
      const existingProof = await storage.getZkProofByNullifier(zkProof.nullifier);
      if (existingProof) {
        res.status(409).json({ 
          error: "Proof already exists for this claim",
          existingProofId: existingProof.id,
          message: "A cryptographic commitment has already been generated for this exact claim. Use the existing proof or revoke it first.",
        });
        return;
      }

      // Store the proof
      const storedProof = await storage.createZkProof({
        walletAddress,
        proofType: "balance",
        proofHash: zkProof.proofHash,
        commitment: zkProof.commitment,
        nullifier: zkProof.nullifier,
        publicInputs: zkProof.publicInputs,
        protocol: zkProof.protocol,
        claim: zkProof.metadata.claim,
        verified: zkProof.verified,
        compressedData: zkProofService.createCompressedProofData(zkProof),
        expiresAt: new Date(zkProof.metadata.expiresAt),
      });

      res.status(201).json({
        proof: storedProof,
        cryptographic: {
          proofHash: zkProof.proofHash,
          commitment: zkProof.commitment,
          publicInputs: zkProof.publicInputs,
          protocol: zkProof.protocol,
        },
      });
    } catch (error) {
      console.error("Error generating balance proof:", error);
      res.status(500).json({ error: "Failed to generate balance proof" });
    }
  });

  app.post("/api/zk/generate/range", async (req, res) => {
    try {
      const { walletAddress, value, minValue, maxValue, label } = req.body;
      
      if (!walletAddress || value === undefined || minValue === undefined || maxValue === undefined || !label) {
        res.status(400).json({ error: "Missing required parameters" });
        return;
      }

      const zkProof = await zkProofService.generateRangeProof(
        walletAddress,
        value,
        minValue,
        maxValue,
        label
      );

      // Check nullifier uniqueness before storing
      const existingProof = await storage.getZkProofByNullifier(zkProof.nullifier);
      if (existingProof) {
        res.status(409).json({ 
          error: "Proof already exists for this claim",
          existingProofId: existingProof.id,
          message: "A cryptographic commitment has already been generated for this exact claim.",
        });
        return;
      }

      const storedProof = await storage.createZkProof({
        walletAddress,
        proofType: "range",
        proofHash: zkProof.proofHash,
        commitment: zkProof.commitment,
        nullifier: zkProof.nullifier,
        publicInputs: zkProof.publicInputs,
        protocol: zkProof.protocol,
        claim: zkProof.metadata.claim,
        verified: zkProof.verified,
        compressedData: zkProofService.createCompressedProofData(zkProof),
        expiresAt: new Date(zkProof.metadata.expiresAt),
      });

      res.status(201).json({
        proof: storedProof,
        cryptographic: {
          proofHash: zkProof.proofHash,
          commitment: zkProof.commitment,
          publicInputs: zkProof.publicInputs,
          protocol: zkProof.protocol,
          inRange: zkProof.verified,
        },
      });
    } catch (error) {
      console.error("Error generating range proof:", error);
      res.status(500).json({ error: "Failed to generate range proof" });
    }
  });

  app.post("/api/zk/generate/transaction", async (req, res) => {
    try {
      const { walletAddress, txSignature, fromToken, toToken, amount } = req.body;
      
      if (!walletAddress || !txSignature || !fromToken || !toToken || amount === undefined) {
        res.status(400).json({ error: "Missing required parameters" });
        return;
      }

      const zkProof = await zkProofService.generateTransactionProof(
        walletAddress,
        txSignature,
        fromToken,
        toToken,
        amount
      );

      // Check nullifier uniqueness before storing
      const existingProof = await storage.getZkProofByNullifier(zkProof.nullifier);
      if (existingProof) {
        res.status(409).json({ 
          error: "Proof already exists for this transaction",
          existingProofId: existingProof.id,
          message: "A cryptographic commitment has already been generated for this transaction.",
        });
        return;
      }

      const storedProof = await storage.createZkProof({
        walletAddress,
        proofType: "transaction",
        proofHash: zkProof.proofHash,
        commitment: zkProof.commitment,
        nullifier: zkProof.nullifier,
        publicInputs: zkProof.publicInputs,
        protocol: zkProof.protocol,
        claim: zkProof.metadata.claim,
        verified: zkProof.verified,
        compressedData: zkProofService.createCompressedProofData(zkProof),
        expiresAt: new Date(zkProof.metadata.expiresAt),
      });

      res.status(201).json({
        proof: storedProof,
        cryptographic: {
          proofHash: zkProof.proofHash,
          commitment: zkProof.commitment,
          publicInputs: zkProof.publicInputs,
          protocol: zkProof.protocol,
        },
      });
    } catch (error) {
      console.error("Error generating transaction proof:", error);
      res.status(500).json({ error: "Failed to generate transaction proof" });
    }
  });

  app.post("/api/zk/generate/ownership", async (req, res) => {
    try {
      const { walletAddress, assetId, assetType } = req.body;
      
      if (!walletAddress || !assetId || !assetType) {
        res.status(400).json({ error: "Missing required parameters" });
        return;
      }

      const zkProof = await zkProofService.generateOwnershipProof(
        walletAddress,
        assetId,
        assetType
      );

      // Check nullifier uniqueness before storing
      const existingProof = await storage.getZkProofByNullifier(zkProof.nullifier);
      if (existingProof) {
        res.status(409).json({ 
          error: "Proof already exists for this asset",
          existingProofId: existingProof.id,
          message: "A cryptographic commitment has already been generated for this asset ownership.",
        });
        return;
      }

      const storedProof = await storage.createZkProof({
        walletAddress,
        proofType: "ownership",
        proofHash: zkProof.proofHash,
        commitment: zkProof.commitment,
        nullifier: zkProof.nullifier,
        publicInputs: zkProof.publicInputs,
        protocol: zkProof.protocol,
        claim: zkProof.metadata.claim,
        verified: zkProof.verified,
        compressedData: zkProofService.createCompressedProofData(zkProof),
        expiresAt: new Date(zkProof.metadata.expiresAt),
      });

      res.status(201).json({
        proof: storedProof,
        cryptographic: {
          proofHash: zkProof.proofHash,
          commitment: zkProof.commitment,
          publicInputs: zkProof.publicInputs,
          protocol: zkProof.protocol,
        },
      });
    } catch (error) {
      console.error("Error generating ownership proof:", error);
      res.status(500).json({ error: "Failed to generate ownership proof" });
    }
  });

  // Get ZK Proofs
  app.get("/api/zk/proofs", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      const proofs = await storage.getZkProofs(walletAddress);
      res.json(proofs);
    } catch (error) {
      console.error("Error fetching ZK proofs:", error);
      res.status(500).json({ error: "Failed to fetch ZK proofs" });
    }
  });

  // Verify ZK Proof - reconstructs from stored data and verifies cryptographic integrity
  app.post("/api/zk/verify/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Fetch the stored proof
      const storedProofs = await storage.getZkProofs(req.body.walletAddress || "");
      const storedProof = storedProofs.find(p => p.id === id);
      
      if (!storedProof) {
        res.status(404).json({ error: "Proof not found" });
        return;
      }

      // Parse compressed data to get the blinding factor
      if (!storedProof.compressedData) {
        res.status(400).json({ 
          error: "Proof verification failed", 
          reason: "No compressed proof data available for verification",
        });
        return;
      }

      const parsedProof = zkProofService.parseCompressedProofData(storedProof.compressedData);
      if (!parsedProof || !parsedProof.blindingFactor) {
        res.status(400).json({ 
          error: "Proof verification failed", 
          reason: "Unable to parse compressed proof data",
        });
        return;
      }

      // Reconstruct the full proof object for integrity verification
      const reconstructedProof = {
        proofHash: storedProof.proofHash,
        commitment: storedProof.commitment,
        nullifier: storedProof.nullifier,
        publicInputs: storedProof.publicInputs as string[],
        timestamp: parsedProof.timestamp!,
        proofType: storedProof.proofType,
        verified: storedProof.verified,
        protocol: storedProof.protocol as "hmac-commitment" | "pedersen-hash" | "light-protocol-ready",
        blindingFactor: parsedProof.blindingFactor,
        metadata: {
          claim: storedProof.claim,
          createdAt: storedProof.createdAt.toISOString(),
          expiresAt: storedProof.expiresAt ? storedProof.expiresAt.toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          version: '2.1.0',
          securityLevel: 'cryptographic-commitment' as const,
          description: '',
        },
      };

      // Verify the proof integrity using cryptographic methods
      const verificationResult = zkProofService.verifyProofIntegrity(reconstructedProof);
      
      if (!verificationResult.valid) {
        res.status(400).json({ 
          error: "Proof integrity verification failed", 
          reason: verificationResult.reason,
          securityLevel: verificationResult.securityLevel,
          nullifier: storedProof.nullifier,
        });
        return;
      }

      // Mark as verified in database only after cryptographic verification passes
      const proof = await storage.verifyZkProof(id);

      res.json({ 
        verified: true, 
        proof,
        verification: {
          integrityValid: true,
          nullifierUnique: true,
          expiryValid: storedProof.expiresAt ? new Date() < new Date(storedProof.expiresAt) : true,
          securityLevel: verificationResult.securityLevel,
        }
      });
    } catch (error) {
      console.error("Error verifying ZK proof:", error);
      res.status(500).json({ error: "Failed to verify ZK proof" });
    }
  });

  // Revoke ZK Proof
  app.post("/api/zk/revoke/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const proof = await storage.revokeZkProof(id);
      
      if (!proof) {
        res.status(404).json({ error: "Proof not found" });
        return;
      }

      res.json({ revoked: true, proof });
    } catch (error) {
      console.error("Error revoking ZK proof:", error);
      res.status(500).json({ error: "Failed to revoke ZK proof" });
    }
  });

  // Check nullifier uniqueness (prevents double-spend)
  app.get("/api/zk/nullifier/:nullifier", async (req, res) => {
    try {
      const { nullifier } = req.params;
      const existingProof = await storage.getZkProofByNullifier(nullifier);
      
      res.json({ 
        exists: !!existingProof,
        used: existingProof ? true : false,
      });
    } catch (error) {
      console.error("Error checking nullifier:", error);
      res.status(500).json({ error: "Failed to check nullifier" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
