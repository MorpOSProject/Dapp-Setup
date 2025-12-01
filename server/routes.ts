import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHash } from "crypto";
import { storage } from "./storage";
import { 
  insertSwapOrderSchema, 
  insertBatchedActionSchema, 
  insertDisclosureProofSchema,
  insertYieldStrategySchema,
  insertComplianceRuleSchema,
  insertMultisigWalletSchema,
  insertMultisigMemberSchema,
  insertMultisigTransactionSchema,
  insertMultisigApprovalSchema,
  insertRoutingProfileSchema,
  routePlanRequestSchema,
  executeRouteRequestSchema,
  type InsertRoutingSegment,
} from "@shared/schema";
import { z } from "zod";
import { 
  getJupiterQuote, 
  getJupiterSwapTransaction, 
  confirmTransaction,
  TOKEN_MINTS, 
  MINT_TO_SYMBOL, 
  getTokenPrices,
  connection,
  buildStealthDepositTransaction,
  buildClaimTransaction,
  executeClaimTransaction,
  getEscrowPublicKey,
} from "./solana";
import { zkProofService } from "./zk-proof";
import { yieldProtocolsService } from "./yield-protocols";
import {
  generateZkCommitmentData,
  verifyZkCommitment,
  formatZkClaimData,
  generateNullifier,
} from "./zk-commitment";

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

  // Shadow Balances - Get all shadow balances for a wallet
  app.get("/api/shadow-balances", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }
      const balances = await storage.getShadowBalances(walletAddress);
      res.json(balances);
    } catch (error) {
      console.error("Error fetching shadow balances:", error);
      res.status(500).json({ error: "Failed to fetch shadow balances" });
    }
  });

  // Move tokens to shadow balance
  app.post("/api/shadow-balances/move-to-shadow", async (req, res) => {
    try {
      const { walletAddress, tokenMint, tokenSymbol, amount } = req.body;
      
      if (!walletAddress || !tokenMint || !tokenSymbol || amount === undefined) {
        res.status(400).json({ error: "Missing required fields: walletAddress, tokenMint, tokenSymbol, amount" });
        return;
      }
      
      if (amount <= 0) {
        res.status(400).json({ error: "Amount must be greater than 0" });
        return;
      }
      
      const result = await storage.moveToShadow(walletAddress, tokenMint, tokenSymbol, amount);
      res.json({ success: true, shadowBalance: result });
    } catch (error) {
      console.error("Error moving to shadow balance:", error);
      res.status(500).json({ error: "Failed to move tokens to shadow balance" });
    }
  });

  // Move tokens from shadow to public balance
  app.post("/api/shadow-balances/move-from-shadow", async (req, res) => {
    try {
      const { walletAddress, tokenMint, amount } = req.body;
      
      if (!walletAddress || !tokenMint || amount === undefined) {
        res.status(400).json({ error: "Missing required fields: walletAddress, tokenMint, amount" });
        return;
      }
      
      if (amount <= 0) {
        res.status(400).json({ error: "Amount must be greater than 0" });
        return;
      }
      
      const result = await storage.moveFromShadow(walletAddress, tokenMint, amount);
      if (!result) {
        res.status(400).json({ error: "Insufficient shadow balance" });
        return;
      }
      
      res.json({ success: true, shadowBalance: result });
    } catch (error) {
      console.error("Error moving from shadow balance:", error);
      res.status(500).json({ error: "Failed to move tokens from shadow balance" });
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

  // DEPRECATED: Backend transaction sending is disabled for wallet security
  // All transactions must be sent directly through the wallet adapter
  // This prevents Phantom and other wallets from flagging the dApp as unsafe
  app.post("/api/swap/send", async (_req, res) => {
    res.status(405).json({ 
      error: "Backend transaction sending is disabled for security",
      message: "Transactions must be sent directly through your wallet for safety"
    });
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
      const { 
        walletAddress, 
        proofType, 
        recipientAddress, 
        recipientName, 
        selectedItems,
        expiresAt,
        rangeConfig,
        balanceData,
        transactionData,
      } = req.body;

      if (!walletAddress || !proofType || !recipientAddress) {
        res.status(400).json({ error: "Missing required parameters" });
        return;
      }

      let zkProof;
      let proofHash = "";
      let commitment = "";
      let protocol = "hmac-commitment";

      // Generate real cryptographic proof based on proof type
      switch (proofType) {
        case "balance":
          // Generate balance proof for selected tokens
          const balances = balanceData || selectedItems.map((item: string) => ({
            symbol: item,
            balance: 0, // Will be fetched from holdings in production
          }));
          
          if (balances.length > 0) {
            const firstBalance = balances[0];
            zkProof = await zkProofService.generateBalanceProof(
              walletAddress,
              firstBalance.balance || 0,
              firstBalance.symbol || selectedItems[0],
              undefined
            );
            proofHash = zkProof.proofHash;
            commitment = zkProof.commitment;
            protocol = zkProof.protocol;
          }
          break;

        case "range":
          // Generate range proof
          if (rangeConfig && rangeConfig.minValue !== undefined && rangeConfig.maxValue !== undefined) {
            const value = balanceData?.value || (rangeConfig.minValue + rangeConfig.maxValue) / 2;
            zkProof = await zkProofService.generateRangeProof(
              walletAddress,
              value,
              rangeConfig.minValue,
              rangeConfig.maxValue,
              rangeConfig.label || "Value"
            );
            proofHash = zkProof.proofHash;
            commitment = zkProof.commitment;
            protocol = zkProof.protocol;
          }
          break;

        case "transaction":
          // Generate transaction proof for selected transactions
          if (transactionData || selectedItems.length > 0) {
            const txData = transactionData || { 
              txSignature: selectedItems[0], 
              fromToken: "SOL", 
              toToken: "USDC", 
              amount: 0 
            };
            zkProof = await zkProofService.generateTransactionProof(
              walletAddress,
              txData.txSignature,
              txData.fromToken,
              txData.toToken,
              txData.amount
            );
            proofHash = zkProof.proofHash;
            commitment = zkProof.commitment;
            protocol = zkProof.protocol;
          }
          break;

        case "signature":
          // Generate wallet ownership proof
          zkProof = await zkProofService.generateOwnershipProof(
            walletAddress,
            "wallet",
            "solana-wallet"
          );
          proofHash = zkProof.proofHash;
          commitment = zkProof.commitment;
          protocol = zkProof.protocol;
          break;

        case "merkle":
          // Generate Merkle tree membership proof
          const merkleLeaves = selectedItems.map((item: string) => `${walletAddress}:${item}`);
          const merkleProof = zkProofService.buildMerkleProofPath(merkleLeaves, 0);
          proofHash = merkleProof.root;
          commitment = merkleProof.leaf;
          protocol = "merkle-tree";
          break;

        case "aggregated":
          // Generate aggregated batch proof
          const individualProofs = [];
          for (const item of selectedItems.slice(0, 5)) {
            const itemProof = await zkProofService.generateBalanceProof(
              walletAddress,
              0,
              item,
              undefined
            );
            individualProofs.push(itemProof);
          }
          if (individualProofs.length > 0) {
            const aggregated = await zkProofService.aggregateProofs(individualProofs);
            proofHash = aggregated.batchRoot;
            commitment = aggregated.aggregateCommitment;
            protocol = "aggregated";
          }
          break;

        case "full":
        default:
          // Full disclosure - simple hash of all items
          const fullData = `${walletAddress}:${selectedItems.join(",")}:${Date.now()}`;
          proofHash = require('crypto').createHash('sha256').update(fullData).digest('hex');
          commitment = proofHash;
          protocol = "hmac-commitment";
          break;
      }

      // If no proof was generated, create a basic hash
      if (!proofHash) {
        const basicData = `${walletAddress}:${proofType}:${selectedItems.join(",")}:${Date.now()}`;
        proofHash = require('crypto').createHash('sha256').update(basicData).digest('hex');
      }

      // Store the disclosure proof with cryptographic data
      const proof = await storage.createDisclosureProof({
        walletAddress,
        proofType,
        recipientAddress,
        recipientName: recipientName || null,
        selectedItems,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }, proofHash);

      // Also store in ZK proofs table if we have a full ZK proof
      if (zkProof) {
        await storage.createZkProof({
          walletAddress,
          proofType,
          proofHash: zkProof.proofHash,
          commitment: zkProof.commitment,
          nullifier: zkProof.nullifier,
          publicInputs: zkProof.publicInputs,
          protocol: zkProof.protocol,
          claim: zkProof.metadata?.claim || `Disclosure: ${proofType}`,
          verified: zkProof.verified,
          compressedData: zkProofService.createCompressedProofData(zkProof),
          expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }

      // Note: storage.createDisclosureProof already adds an audit entry

      res.status(201).json({
        ...proof,
        cryptographic: {
          proofHash,
          commitment,
          protocol,
          verified: zkProof?.verified ?? true,
        },
      });
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
        protocol: "marinade",
        name: "Marinade SOL Staking",
        strategyType: "staking",
        depositToken: "SOL",
        depositAmount: amount,
        apy: 6.5,
        rewardsToken: "mSOL",
        isPrivate: true,
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
      
      // Note: storage.createComplianceRule already adds an audit entry
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
      
      // Add to audit trail using correct signature
      const changedFields = Object.keys(req.body).join(", ");
      await storage.addAuditEntry(
        rule.walletAddress,
        "compliance_rule_updated",
        `Compliance rule updated: ${rule.name} (${changedFields})`,
        { ruleId: rule.id, changedFields, ...req.body }
      );
      
      res.json(rule);
    } catch (error) {
      console.error("Error updating compliance rule:", error);
      res.status(500).json({ error: "Failed to update compliance rule" });
    }
  });

  app.delete("/api/compliance/rules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // First get the rule by ID to obtain walletAddress for audit trail
      const rule = await storage.getComplianceRuleById(id);
      
      if (!rule) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }
      
      await storage.deleteComplianceRule(id);
      
      // Add to audit trail using correct signature
      await storage.addAuditEntry(
        rule.walletAddress,
        "compliance_rule_deleted",
        `Compliance rule deleted: ${rule.name}`,
        { ruleId: id, ruleName: rule.name, ruleType: rule.ruleType }
      );
      
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
        protocol: storedProof.protocol as "hmac-commitment" | "pedersen-hash" | "merkle-tree" | "schnorr-signature" | "bulletproof-range" | "aggregated",
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

  // ==================== STEALTH PAYMENTS ====================

  // Generate a unique claim code and stealth key
  function generateClaimCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude similar chars
    let code = "";
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function generateStealthKey(): string {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Get escrow wallet address (for transparency)
  app.get("/api/stealth/escrow", async (req, res) => {
    try {
      const escrowAddress = getEscrowPublicKey();
      if (!escrowAddress) {
        res.status(500).json({ error: "Escrow wallet not configured" });
        return;
      }
      res.json({ escrowAddress });
    } catch (error) {
      console.error("Error getting escrow address:", error);
      res.status(500).json({ error: "Failed to get escrow address" });
    }
  });

  // Step 1: Build deposit transaction for sender to sign
  app.post("/api/stealth/build-deposit", async (req, res) => {
    try {
      const { senderWallet, tokenMint, amount } = req.body;

      if (!senderWallet || !tokenMint || amount === undefined) {
        res.status(400).json({ error: "Missing required fields: senderWallet, tokenMint, amount" });
        return;
      }

      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
        res.status(400).json({ error: "Amount must be a valid positive number" });
        return;
      }

      // Get token decimals
      const tokenInfo = TOKEN_MINTS[MINT_TO_SYMBOL[tokenMint] || ""];
      const decimals = tokenInfo?.decimals || 6;

      // Build unsigned transaction
      const result = await buildStealthDepositTransaction(
        senderWallet,
        tokenMint,
        numericAmount,
        decimals
      );

      if (!result) {
        res.status(500).json({ error: "Failed to build deposit transaction" });
        return;
      }

      res.json({
        success: true,
        transaction: result.transaction,
        escrowWallet: result.escrowWallet,
      });
    } catch (error) {
      console.error("Error building deposit transaction:", error);
      res.status(500).json({ error: "Failed to build deposit transaction" });
    }
  });

  // Step 2: Create stealth payment record after sender confirms deposit
  // Supports ZK Commitment mode for enhanced privacy (amount hidden)
  app.post("/api/stealth/create", async (req, res) => {
    try {
      const { 
        senderWallet, tokenMint, tokenSymbol, amount, 
        recipientHint, message, expiresInDays, txSignature,
        zkEnabled // Enable ZK commitment mode for maximum privacy
      } = req.body;

      if (!senderWallet || !tokenMint || !tokenSymbol || amount === undefined) {
        res.status(400).json({ error: "Missing required fields: senderWallet, tokenMint, tokenSymbol, amount" });
        return;
      }

      // Robust validation for amount - reject NaN, non-numbers, and invalid values
      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
        res.status(400).json({ error: "Amount must be a valid positive number" });
        return;
      }

      // Get token price for USD value
      const prices = await getTokenPrices([tokenMint]);
      const price = prices.get(tokenMint) || 0;
      const valueUsd = numericAmount * price;

      // Generate unique claim code and stealth key
      const claimCode = generateClaimCode();
      const stealthKey = generateStealthKey();

      // Calculate expiry date if provided
      let expiresAt: Date | undefined;
      if (expiresInDays && expiresInDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      // ZK Commitment mode - hide the actual amount
      let zkCommitment: string | null = null;
      let zkSalt: string | null = null;
      let zkSecret: string | null = null;
      let storedAmount = numericAmount;

      if (zkEnabled) {
        // Generate ZK commitment data
        const zkData = generateZkCommitmentData(numericAmount);
        zkCommitment = zkData.commitment;
        zkSalt = zkData.salt;
        zkSecret = zkData.secret;
        // For ZK payments, we store 0 as the amount - actual amount is hidden in commitment
        storedAmount = 0;
        console.log(`Creating ZK stealth payment. Commitment: ${zkCommitment.slice(0, 16)}...`);
      }

      const payment = await storage.createStealthPayment({
        senderWallet,
        tokenMint,
        tokenSymbol,
        amount: storedAmount,
        valueUsd: zkEnabled ? 0 : valueUsd, // Hide value too for ZK
        claimCode,
        stealthKey,
        recipientHint: recipientHint || null,
        message: message || null,
        expiresAt: expiresAt || null,
        txSignature: txSignature || null,
        zkEnabled: zkEnabled || false,
        zkCommitment,
        zkSalt,
        zkSecret,
      });

      // For ZK payments, return the secret data that sender must share with recipient
      const response: any = { 
        success: true, 
        payment,
        claimCode,
        claimUrl: `/stealth/claim?code=${claimCode}`,
      };

      if (zkEnabled && zkSecret) {
        // IMPORTANT: This secret data must be shared with recipient off-chain
        // Without it, they cannot prove ownership and claim the payment
        response.zkClaimData = formatZkClaimData(claimCode, numericAmount, zkSecret, tokenSymbol);
        response.zkInfo = {
          commitment: zkCommitment,
          actualAmount: numericAmount,
          secret: zkSecret,
          tokenSymbol,
          instructions: "Share zkClaimData with recipient. They need this to claim the payment.",
        };
      }

      res.json(response);
    } catch (error) {
      console.error("Error creating stealth payment:", error);
      res.status(500).json({ error: "Failed to create stealth payment" });
    }
  });

  // Get stealth payments sent by a wallet
  app.get("/api/stealth/sent", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string || "";
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }
      const payments = await storage.getStealthPaymentsSent(walletAddress);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching sent stealth payments:", error);
      res.status(500).json({ error: "Failed to fetch sent stealth payments" });
    }
  });

  // Get pending payments (for admin/debugging)
  app.get("/api/stealth/pending", async (req, res) => {
    try {
      const payments = await storage.getPendingStealthPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching pending stealth payments:", error);
      res.status(500).json({ error: "Failed to fetch pending stealth payments" });
    }
  });

  // Lookup a stealth payment by claim code (without claiming)
  // For ZK payments, amount is hidden - recipient must provide proof
  app.get("/api/stealth/lookup/:claimCode", async (req, res) => {
    try {
      const { claimCode } = req.params;
      const payment = await storage.getStealthPaymentByClaimCode(claimCode);

      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      // For ZK payments, hide amount info
      const isZk = payment.zkEnabled;
      
      res.json({
        id: payment.id,
        tokenSymbol: payment.tokenSymbol,
        amount: isZk ? null : payment.amount, // Hidden for ZK
        valueUsd: isZk ? null : payment.valueUsd, // Hidden for ZK
        status: payment.status,
        message: payment.message,
        expiresAt: payment.expiresAt,
        isExpired: payment.expiresAt ? new Date(payment.expiresAt) < new Date() : false,
        zkEnabled: isZk,
        zkCommitment: isZk ? payment.zkCommitment : null, // Show commitment for verification
        requiresZkProof: isZk, // Indicates recipient needs to provide proof
      });
    } catch (error) {
      console.error("Error looking up stealth payment:", error);
      res.status(500).json({ error: "Failed to lookup stealth payment" });
    }
  });

  // Build claim transaction - returns partially signed tx for claimer to sign
  // Claimer pays transaction fees (non-custodial for fees)
  // For ZK payments, recipient must provide proof (amount + secret)
  app.post("/api/stealth/build-claim", async (req, res) => {
    try {
      const { claimCode, claimerWallet, zkProof } = req.body;

      if (!claimCode || !claimerWallet) {
        res.status(400).json({ error: "Missing required fields: claimCode, claimerWallet" });
        return;
      }

      const payment = await storage.getStealthPaymentByClaimCode(claimCode);
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      if (payment.status !== "pending") {
        res.status(400).json({ error: `Payment cannot be claimed. Status: ${payment.status}` });
        return;
      }

      if (payment.expiresAt && new Date(payment.expiresAt) < new Date()) {
        res.status(400).json({ error: "Payment has expired" });
        return;
      }

      // For ZK payments, verify the proof before building transaction
      let claimAmount = payment.amount;
      
      if (payment.zkEnabled) {
        if (!zkProof || !zkProof.amount || !zkProof.secret) {
          res.status(400).json({ 
            error: "This is a ZK private payment. You must provide zkProof with amount and secret.",
            requiresZkProof: true,
          });
          return;
        }

        // Verify the ZK commitment
        const isValid = verifyZkCommitment(
          payment.zkCommitment!,
          zkProof.amount,
          zkProof.secret,
          payment.zkSalt!
        );

        if (!isValid) {
          res.status(400).json({ 
            error: "Invalid ZK proof. The amount or secret is incorrect.",
            zkVerificationFailed: true,
          });
          return;
        }

        // Use the proven amount for the transaction
        claimAmount = zkProof.amount;
        console.log(`ZK proof verified! Amount: ${claimAmount} ${payment.tokenSymbol}`);
      }

      const tokenInfo = TOKEN_MINTS[MINT_TO_SYMBOL[payment.tokenMint] || ""];
      const decimals = tokenInfo?.decimals || 6;

      console.log(`Building claim transaction: ${claimAmount} ${payment.tokenSymbol} to ${claimerWallet}`);
      const result = await buildClaimTransaction(
        claimerWallet,
        payment.tokenMint,
        claimAmount,
        decimals
      );

      if (!result) {
        res.status(500).json({ error: "Failed to build claim transaction" });
        return;
      }

      res.json({
        success: true,
        transaction: result.transaction,
        paymentId: payment.id,
        amount: claimAmount,
        tokenSymbol: payment.tokenSymbol,
        zkVerified: payment.zkEnabled,
      });
    } catch (error) {
      console.error("Error building claim transaction:", error);
      res.status(500).json({ error: "Failed to build claim transaction" });
    }
  });

  // Execute claim - receives signed transaction and broadcasts it
  app.post("/api/stealth/execute-claim", async (req, res) => {
    try {
      const { claimCode, claimerWallet, signedTransaction } = req.body;

      if (!claimCode || !claimerWallet || !signedTransaction) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const existingPayment = await storage.getStealthPaymentByClaimCode(claimCode);
      if (!existingPayment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      if (existingPayment.status !== "pending") {
        res.status(400).json({ error: `Payment already ${existingPayment.status}` });
        return;
      }

      console.log(`Executing claim for ${existingPayment.amount} ${existingPayment.tokenSymbol}...`);
      const result = await executeClaimTransaction(signedTransaction);

      if (!result) {
        res.status(500).json({ error: "Failed to execute claim transaction" });
        return;
      }

      const payment = await storage.claimStealthPayment(claimCode, claimerWallet, result.signature);

      if (!payment) {
        console.error("Claim executed but database update failed!");
        res.status(500).json({ 
          error: "Claim executed but record update failed. Signature: " + result.signature 
        });
        return;
      }

      res.json({ 
        success: true, 
        payment,
        txSignature: result.signature,
        message: `Successfully claimed ${payment.amount} ${payment.tokenSymbol}!`,
      });
    } catch (error) {
      console.error("Error executing claim:", error);
      res.status(500).json({ error: "Failed to execute claim" });
    }
  });

  // Cancel a stealth payment (sender only)
  app.post("/api/stealth/cancel/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { senderWallet } = req.body;

      if (!senderWallet) {
        res.status(400).json({ error: "Missing senderWallet" });
        return;
      }

      const payment = await storage.cancelStealthPayment(id, senderWallet);

      if (!payment) {
        res.status(400).json({ error: "Unable to cancel payment. It may not exist, already claimed, or you're not the sender." });
        return;
      }

      res.json({ 
        success: true, 
        payment,
        message: "Payment cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling stealth payment:", error);
      res.status(500).json({ error: "Failed to cancel stealth payment" });
    }
  });

  // ==================== Multi-Sig Private Wallets ====================
  
  // Validation schemas for multi-sig endpoints
  const createMultisigWalletRequestSchema = z.object({
    name: z.string().min(1, "Name is required"),
    creatorWallet: z.string().min(1, "Creator wallet is required"),
    threshold: z.number().int().positive("Threshold must be positive"),
    totalMembers: z.number().int().min(2, "At least 2 members required"),
    description: z.string().nullable().optional(),
    memberPubkeyHashes: z.array(z.string().min(1)).min(2, "At least 2 member hashes required"),
  }).refine(data => data.threshold <= data.totalMembers, {
    message: "Threshold cannot exceed total members"
  }).refine(data => data.memberPubkeyHashes.length === data.totalMembers, {
    message: "Number of member hashes must match totalMembers"
  });
  
  // Create a new multi-sig wallet
  app.post("/api/multisig/wallets", async (req, res) => {
    try {
      const validated = createMultisigWalletRequestSchema.parse(req.body);
      const { name, creatorWallet, threshold, totalMembers, description, memberPubkeyHashes } = validated;
      
      const wallet = await storage.createMultisigWallet({
        name,
        creatorWallet,
        threshold,
        totalMembers,
        description: description || null,
      });
      
      for (const hash of memberPubkeyHashes) {
        await storage.addMultisigMember({
          walletId: wallet.id,
          memberPubkeyHash: hash,
        });
      }
      
      res.json({
        success: true,
        wallet,
        message: `Multi-sig wallet created with ${threshold}/${totalMembers} threshold`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
        return;
      }
      console.error("Error creating multi-sig wallet:", error);
      res.status(500).json({ error: "Failed to create multi-sig wallet" });
    }
  });
  
  // Get multi-sig wallets for a user
  app.get("/api/multisig/wallets", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      if (!walletAddress) {
        res.status(400).json({ error: "Missing wallet parameter" });
        return;
      }
      
      const wallets = await storage.getMultisigWallets(walletAddress);
      res.json(wallets);
    } catch (error) {
      console.error("Error fetching multi-sig wallets:", error);
      res.status(500).json({ error: "Failed to fetch multi-sig wallets" });
    }
  });
  
  // Get a specific multi-sig wallet by ID
  app.get("/api/multisig/wallets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const wallet = await storage.getMultisigWalletById(id);
      
      if (!wallet) {
        res.status(404).json({ error: "Wallet not found" });
        return;
      }
      
      const members = await storage.getMultisigMembers(id);
      const transactions = await storage.getMultisigTransactions(id);
      const pendingTransactions = await storage.getPendingMultisigTransactions(id);
      
      res.json({
        wallet,
        members,
        transactions,
        pendingCount: pendingTransactions.length,
      });
    } catch (error) {
      console.error("Error fetching multi-sig wallet:", error);
      res.status(500).json({ error: "Failed to fetch multi-sig wallet" });
    }
  });
  
  // Validation schema for transaction proposals
  const proposeTransactionRequestSchema = z.object({
    walletId: z.string().min(1, "Wallet ID is required"),
    txType: z.enum(["transfer", "add_member", "remove_member", "change_threshold"]),
    tokenMint: z.string().nullable().optional(),
    tokenSymbol: z.string().nullable().optional(),
    amount: z.union([z.string(), z.number()]).nullable().optional(),
    recipientAddress: z.string().nullable().optional(),
    description: z.string().min(1, "Description is required"),
    initiatedByHash: z.string().min(1, "Initiator hash is required"),
  });
  
  // Validation schema for approvals
  const approveTransactionRequestSchema = z.object({
    approvalCommitment: z.string().min(1, "Approval commitment is required"),
    nullifierHash: z.string().min(1, "Nullifier hash is required"),
    membershipProof: z.string().nullable().optional(),
  });
  
  // Propose a new transaction
  app.post("/api/multisig/transactions", async (req, res) => {
    try {
      const validated = proposeTransactionRequestSchema.parse(req.body);
      const { 
        walletId, 
        txType, 
        tokenMint, 
        tokenSymbol, 
        amount, 
        recipientAddress, 
        description,
        initiatedByHash 
      } = validated;
      
      const wallet = await storage.getMultisigWalletById(walletId);
      if (!wallet) {
        res.status(404).json({ error: "Wallet not found" });
        return;
      }
      
      const isMember = await storage.isMemberOfWallet(walletId, initiatedByHash);
      if (!isMember) {
        res.status(403).json({ error: "Only members can propose transactions" });
        return;
      }
      
      const transaction = await storage.createMultisigTransaction({
        walletId,
        txType,
        tokenMint: tokenMint || null,
        tokenSymbol: tokenSymbol || null,
        amount: amount ? parseFloat(amount) : null,
        recipientAddress: recipientAddress || null,
        description,
        requiredApprovals: wallet.threshold,
        initiatedByHash,
      });
      
      await storage.addAuditEntry(
        wallet.creatorWallet,
        "multisig_tx_proposed",
        `New ${txType} transaction proposed${amount ? ` for ${amount} ${tokenSymbol}` : ""}`,
        { transactionId: transaction.id, walletId, txType, amount }
      );
      
      res.json({
        success: true,
        transaction,
        message: `Transaction proposed. Requires ${wallet.threshold} approvals.`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
        return;
      }
      console.error("Error proposing transaction:", error);
      res.status(500).json({ error: "Failed to propose transaction" });
    }
  });
  
  // Get transactions for a wallet
  app.get("/api/multisig/wallets/:walletId/transactions", async (req, res) => {
    try {
      const { walletId } = req.params;
      const transactions = await storage.getMultisigTransactions(walletId);
      
      const txsWithApprovals = await Promise.all(
        transactions.map(async (tx) => {
          const approvals = await storage.getMultisigApprovals(tx.id);
          return { ...tx, approvals };
        })
      );
      
      res.json(txsWithApprovals);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  
  // Approve a transaction privately
  app.post("/api/multisig/transactions/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = approveTransactionRequestSchema.parse(req.body);
      const { 
        approvalCommitment, 
        nullifierHash,
        membershipProof 
      } = validated;
      
      const transaction = await storage.getMultisigTransactionById(id);
      if (!transaction) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }
      
      if (transaction.status !== "pending") {
        res.status(400).json({ error: "Transaction is not pending" });
        return;
      }
      
      const alreadyApproved = await storage.hasApproved(id, nullifierHash);
      if (alreadyApproved) {
        res.status(400).json({ error: "This member has already approved" });
        return;
      }
      
      const approval = await storage.addMultisigApproval({
        walletId: transaction.walletId,
        transactionId: id,
        approvalCommitment,
        nullifierHash,
        membershipProof: membershipProof || null,
      });
      
      const updatedTx = await storage.getMultisigTransactionById(id);
      const wallet = await storage.getMultisigWalletById(transaction.walletId);
      
      if (wallet) {
        await storage.addAuditEntry(
          wallet.creatorWallet,
          "multisig_tx_approved",
          `Transaction ${id} received private approval (${updatedTx?.approvalCount}/${transaction.requiredApprovals})`,
          { transactionId: id, approvalCount: updatedTx?.approvalCount }
        );
      }
      
      res.json({
        success: true,
        approval,
        transaction: updatedTx,
        message: updatedTx?.status === "approved" 
          ? "Transaction fully approved and ready for execution"
          : `Approval recorded. ${updatedTx?.approvalCount}/${transaction.requiredApprovals} approvals.`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
        return;
      }
      console.error("Error approving transaction:", error);
      res.status(500).json({ error: "Failed to approve transaction" });
    }
  });
  
  // Execute an approved transaction
  app.post("/api/multisig/transactions/:id/execute", async (req, res) => {
    try {
      const { id } = req.params;
      const { executorWallet } = req.body;
      
      const transaction = await storage.getMultisigTransactionById(id);
      if (!transaction) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }
      
      if (transaction.status !== "approved") {
        res.status(400).json({ error: "Transaction is not approved" });
        return;
      }
      
      const wallet = await storage.getMultisigWalletById(transaction.walletId);
      if (!wallet) {
        res.status(404).json({ error: "Wallet not found" });
        return;
      }
      
      const updatedTx = await storage.updateMultisigTransaction(id, {
        status: "executed",
        executedAt: new Date(),
      });
      
      await storage.addAuditEntry(
        wallet.creatorWallet,
        "multisig_tx_executed",
        `Transaction executed: ${transaction.amount || ""} ${transaction.tokenSymbol || ""} ${transaction.txType}`,
        { transactionId: id, executorWallet }
      );
      
      res.json({
        success: true,
        transaction: updatedTx,
        message: "Transaction executed successfully",
      });
    } catch (error) {
      console.error("Error executing transaction:", error);
      res.status(500).json({ error: "Failed to execute transaction" });
    }
  });
  
  // Reject a pending transaction
  app.post("/api/multisig/transactions/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const { rejectorWallet, reason } = req.body;
      
      const transaction = await storage.getMultisigTransactionById(id);
      if (!transaction) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }
      
      if (transaction.status !== "pending") {
        res.status(400).json({ error: "Only pending transactions can be rejected" });
        return;
      }
      
      const wallet = await storage.getMultisigWalletById(transaction.walletId);
      if (!wallet) {
        res.status(404).json({ error: "Wallet not found" });
        return;
      }
      
      if (wallet.creatorWallet !== rejectorWallet) {
        res.status(403).json({ error: "Only wallet creator can reject transactions" });
        return;
      }
      
      const updatedTx = await storage.updateMultisigTransaction(id, {
        status: "rejected",
      });
      
      await storage.addAuditEntry(
        wallet.creatorWallet,
        "multisig_tx_rejected",
        `Transaction rejected${reason ? `: ${reason}` : ""}`,
        { transactionId: id, reason }
      );
      
      res.json({
        success: true,
        transaction: updatedTx,
        message: "Transaction rejected",
      });
    } catch (error) {
      console.error("Error rejecting transaction:", error);
      res.status(500).json({ error: "Failed to reject transaction" });
    }
  });
  
  // Generate ZK membership proof hash
  app.post("/api/multisig/generate-membership-proof", async (req, res) => {
    try {
      const { walletId, memberPubkey, secret } = req.body;
      
      if (!walletId || !memberPubkey || !secret) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      
      const memberPubkeyHash = createHash('sha256')
        .update(memberPubkey)
        .digest('hex');
      
      const isMember = await storage.isMemberOfWallet(walletId, memberPubkeyHash);
      if (!isMember) {
        res.status(403).json({ error: "Not a member of this wallet" });
        return;
      }
      
      const membershipProofHash = createHash('sha256')
        .update(`${walletId}:${memberPubkeyHash}:${secret}`)
        .digest('hex');
      
      const nullifierHash = createHash('sha256')
        .update(`${walletId}:${memberPubkey}:nullifier`)
        .digest('hex');
      
      res.json({
        memberPubkeyHash,
        membershipProofHash,
        nullifierHash,
        message: "Use these values to privately approve transactions",
      });
    } catch (error) {
      console.error("Error generating membership proof:", error);
      res.status(500).json({ error: "Failed to generate membership proof" });
    }
  });
  
  // Hash a public key (for wallet creation)
  app.post("/api/multisig/hash-pubkey", async (req, res) => {
    try {
      const { pubkey } = req.body;
      
      if (!pubkey) {
        res.status(400).json({ error: "Missing pubkey" });
        return;
      }
      
      const hash = createHash('sha256')
        .update(pubkey)
        .digest('hex');
      
      res.json({ hash });
    } catch (error) {
      console.error("Error hashing pubkey:", error);
      res.status(500).json({ error: "Failed to hash pubkey" });
    }
  });

  // ============================================
  // PRIVATE ROUTING LAYER ENDPOINTS
  // ============================================

  // Get routing profile for a wallet
  app.get("/api/private-routing/profile", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }
      
      let profile = await storage.getRoutingProfile(walletAddress);
      
      // Create default profile if none exists
      if (!profile) {
        profile = await storage.createRoutingProfile({
          walletAddress,
          enableRouteObfuscation: true,
          enableDecoyTransactions: true,
          enableTimingRandomization: true,
          enableTransactionSplitting: false,
          decoyDensity: 2,
          minDelayMs: 1000,
          maxDelayMs: 5000,
          splitThreshold: 1000,
          maxSplitParts: 3,
          privacyLevel: "enhanced",
        });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching routing profile:", error);
      res.status(500).json({ error: "Failed to fetch routing profile" });
    }
  });

  // Update routing profile
  app.patch("/api/private-routing/profile", async (req, res) => {
    try {
      const { walletAddress, ...updates } = req.body;
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }
      
      // Ensure profile exists
      let profile = await storage.getRoutingProfile(walletAddress);
      if (!profile) {
        profile = await storage.createRoutingProfile({
          walletAddress,
          ...updates,
        });
      } else {
        profile = await storage.updateRoutingProfile(walletAddress, updates);
      }
      
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid profile data", details: error.errors });
      } else {
        console.error("Error updating routing profile:", error);
        res.status(500).json({ error: "Failed to update routing profile" });
      }
    }
  });

  // Create a privacy-enhanced route plan
  app.post("/api/private-routing/plan", async (req, res) => {
    try {
      const validatedData = routePlanRequestSchema.parse(req.body);
      const { walletAddress, inputToken, outputToken, amount, slippageBps } = validatedData;
      
      // Get user's routing profile for settings
      let profile = await storage.getRoutingProfile(walletAddress);
      if (!profile) {
        profile = await storage.createRoutingProfile({
          walletAddress,
          enableRouteObfuscation: true,
          enableDecoyTransactions: true,
          enableTimingRandomization: true,
          enableTransactionSplitting: false,
          decoyDensity: 2,
          minDelayMs: 1000,
          maxDelayMs: 5000,
          splitThreshold: 1000,
          maxSplitParts: 3,
          privacyLevel: "enhanced",
        });
      }
      
      // Generate random seed for deterministic decoy generation
      const randomSeed = createHash('sha256')
        .update(`${walletAddress}:${Date.now()}:${Math.random()}`)
        .digest('hex');
      
      // Calculate privacy settings
      const enableDecoys = validatedData.enableDecoys ?? profile.enableDecoyTransactions;
      const enableTimingJitter = validatedData.enableTimingJitter ?? profile.enableTimingRandomization;
      const enableSplitting = validatedData.enableSplitting ?? profile.enableTransactionSplitting;
      const decoyCount = validatedData.customDecoyCount ?? profile.decoyDensity;
      
      // Calculate number of real segments (for splitting)
      let realSegmentCount = 1;
      if (enableSplitting && amount > profile.splitThreshold) {
        realSegmentCount = Math.min(profile.maxSplitParts, Math.ceil(amount / profile.splitThreshold));
      }
      
      // Create the routing batch
      const now = new Date();
      const estimatedDuration = (realSegmentCount + decoyCount) * (profile.maxDelayMs + 2000);
      const endTime = new Date(now.getTime() + estimatedDuration);
      
      const batch = await storage.createRoutingBatch({
        walletAddress,
        randomSeed,
        scheduledStartAt: now,
        scheduledEndAt: endTime,
        linkedSwapId: null,
        linkedStealthPaymentId: null,
        linkedBatchActionId: null,
        routeMetadata: {
          inputToken,
          outputToken,
          totalAmount: amount,
          splitCount: realSegmentCount,
          decoyCount: enableDecoys ? decoyCount : 0,
        },
      });
      
      // Generate segments
      const segments: InsertRoutingSegment[] = [];
      const totalSegments = realSegmentCount + (enableDecoys ? decoyCount : 0);
      
      // Generate real segments
      const splitAmount = amount / realSegmentCount;
      for (let i = 0; i < realSegmentCount; i++) {
        const delay = enableTimingJitter
          ? Math.floor(Math.random() * (profile.maxDelayMs - profile.minDelayMs)) + profile.minDelayMs
          : 0;
        
        const commitment = createHash('sha256')
          .update(`${batch.id}:${i}:real:${randomSeed}`)
          .digest('hex');
        
        const nullifierHash = createHash('sha256')
          .update(`${batch.id}:${walletAddress}:${i}`)
          .digest('hex');
        
        segments.push({
          batchId: batch.id,
          segmentType: realSegmentCount > 1 ? "split" : "real",
          segmentIndex: i,
          commitment,
          nullifierHash,
          routeHashedId: createHash('sha256').update(`route:${inputToken}:${outputToken}:${i}`).digest('hex'),
          dexProtocolHash: createHash('sha256').update('jupiter').digest('hex'),
          amount: splitAmount,
          tokenMint: inputToken,
          tokenSymbol: MINT_TO_SYMBOL[inputToken] || inputToken.slice(0, 4),
          scheduledAt: new Date(now.getTime() + (i * (profile.maxDelayMs / 2)) + delay),
          delayAppliedMs: delay,
        });
      }
      
      // Generate decoy segments
      if (enableDecoys) {
        const decoyTokens = Object.keys(TOKEN_MINTS).filter(t => t !== inputToken && t !== outputToken);
        
        for (let i = 0; i < decoyCount; i++) {
          const segmentIndex = realSegmentCount + i;
          const delay = enableTimingJitter
            ? Math.floor(Math.random() * (profile.maxDelayMs - profile.minDelayMs)) + profile.minDelayMs
            : 0;
          
          const commitment = createHash('sha256')
            .update(`${batch.id}:${segmentIndex}:decoy:${randomSeed}`)
            .digest('hex');
          
          const nullifierHash = createHash('sha256')
            .update(`${batch.id}:${walletAddress}:${segmentIndex}`)
            .digest('hex');
          
          const randomToken = decoyTokens[Math.floor(Math.random() * decoyTokens.length)] || "SOL";
          
          segments.push({
            batchId: batch.id,
            segmentType: "decoy",
            segmentIndex,
            commitment,
            nullifierHash,
            routeHashedId: createHash('sha256').update(`decoy:${randomToken}:${segmentIndex}`).digest('hex'),
            dexProtocolHash: createHash('sha256').update('jupiter').digest('hex'),
            amount: null, // Hidden for decoys
            tokenMint: null,
            tokenSymbol: null,
            scheduledAt: new Date(now.getTime() + Math.random() * estimatedDuration),
            delayAppliedMs: delay,
          });
        }
      }
      
      // Shuffle segments for unpredictability
      segments.sort(() => Math.random() - 0.5);
      segments.forEach((seg, idx) => {
        seg.segmentIndex = idx;
      });
      
      // Save segments
      await storage.createRoutingSegments(segments);
      
      // Calculate privacy score
      const decoyRatio = enableDecoys ? (decoyCount / totalSegments) : 0;
      const timingEntropy = enableTimingJitter ? 0.8 : 0.2;
      const splitBonus = realSegmentCount > 1 ? 15 : 0;
      const privacyScore = Math.min(100, Math.round(
        (decoyRatio * 40) + (timingEntropy * 30) + splitBonus + 15
      ));
      
      // Update batch with computed values
      await storage.updateRoutingBatch(batch.id, {
        status: "scheduled",
        totalSegments,
        privacyScore,
        obfuscationLevel: decoyCount,
        timingJitterApplied: enableTimingJitter,
      });
      
      // Build response
      const segmentPreviews = segments.map(s => ({
        index: s.segmentIndex,
        type: s.segmentType as "real" | "decoy" | "split",
        tokenSymbol: s.segmentType === "decoy" ? undefined : s.tokenSymbol,
        amountMasked: s.segmentType === "decoy",
        scheduledDelay: s.delayAppliedMs || 0,
        dexProtocol: s.segmentType === "decoy" ? undefined : "Jupiter",
        commitment: s.commitment,
      }));
      
      res.json({
        batchId: batch.id,
        privacyScore,
        totalSegments,
        realSegments: realSegmentCount,
        decoySegments: enableDecoys ? decoyCount : 0,
        splitSegments: realSegmentCount > 1 ? realSegmentCount : 0,
        estimatedDurationMs: estimatedDuration,
        timingWindow: {
          start: now.toISOString(),
          end: endTime.toISOString(),
        },
        segments: segmentPreviews,
        obfuscationDetails: {
          decoyDensity: enableDecoys ? decoyCount : 0,
          timingEntropyLevel: enableTimingJitter ? "high" : "low",
          routeDiversityScore: Math.round(decoyRatio * 100),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid route plan request", details: error.errors });
      } else {
        console.error("Error creating route plan:", error);
        res.status(500).json({ error: "Failed to create route plan" });
      }
    }
  });

  // Execute a planned route
  app.post("/api/private-routing/execute", async (req, res) => {
    try {
      const validatedData = executeRouteRequestSchema.parse(req.body);
      const { batchId, walletAddress } = validatedData;
      
      const batch = await storage.getRoutingBatch(batchId);
      if (!batch) {
        res.status(404).json({ error: "Routing batch not found" });
        return;
      }
      
      if (batch.walletAddress !== walletAddress) {
        res.status(403).json({ error: "Not authorized to execute this route" });
        return;
      }
      
      if (batch.status !== "scheduled") {
        res.status(400).json({ error: `Cannot execute batch with status: ${batch.status}` });
        return;
      }
      
      // Mark batch as executing
      await storage.updateRoutingBatch(batchId, {
        status: "executing",
        actualStartAt: new Date(),
      });
      
      // Get segments and process them
      const segments = await storage.getRoutingSegments(batchId);
      let completedCount = 0;
      let failedCount = 0;
      
      for (const segment of segments) {
        try {
          if (segment.segmentType === "decoy") {
            // Decoys are simulated - just mark as completed with small delay
            await new Promise(resolve => setTimeout(resolve, 100));
            await storage.updateRoutingSegment(segment.id, {
              status: "completed",
              executedAt: new Date(),
            });
          } else {
            // Real segments would execute actual transactions
            // For now, mark as completed (actual execution requires signed tx from client)
            await storage.updateRoutingSegment(segment.id, {
              status: "completed",
              executedAt: new Date(),
            });
          }
          completedCount++;
        } catch (segError) {
          console.error(`Error processing segment ${segment.id}:`, segError);
          await storage.updateRoutingSegment(segment.id, {
            status: "failed",
            errorMessage: String(segError),
          });
          failedCount++;
        }
        
        // Update batch progress
        await storage.updateRoutingBatch(batchId, {
          completedSegments: completedCount,
        });
      }
      
      // Finalize batch
      const finalStatus = failedCount > 0 ? "failed" : "completed";
      await storage.updateRoutingBatch(batchId, {
        status: finalStatus,
        actualEndAt: new Date(),
      });
      
      // Record metrics
      await storage.recordRouteMetric({
        walletAddress,
        batchId,
        metricType: "batch",
        success: failedCount === 0,
        failureReason: failedCount > 0 ? `${failedCount} segments failed` : undefined,
        privacyScoreContribution: batch.privacyScore,
        decoyEffectiveness: batch.obfuscationLevel ? (batch.obfuscationLevel / segments.length) * 100 : 0,
        timingEntropy: batch.timingJitterApplied ? 0.85 : 0.15,
        routeDiversity: segments.filter(s => s.segmentType === "decoy").length / segments.length,
      });
      
      await storage.addAuditEntry(
        walletAddress,
        "routing_batch_executed",
        `Privacy-enhanced routing batch ${finalStatus}: ${completedCount}/${segments.length} segments completed`,
        { batchId, completedCount, failedCount, privacyScore: batch.privacyScore }
      );
      
      res.json({
        success: failedCount === 0,
        batchId,
        status: finalStatus,
        completedSegments: completedCount,
        failedSegments: failedCount,
        totalSegments: segments.length,
        privacyScore: batch.privacyScore,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid execute request", details: error.errors });
      } else {
        console.error("Error executing route:", error);
        res.status(500).json({ error: "Failed to execute route" });
      }
    }
  });

  // Get routing history
  app.get("/api/private-routing/history", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }
      
      const batches = await storage.getRoutingBatches(walletAddress);
      
      const history = batches.map(batch => ({
        batchId: batch.id,
        status: batch.status,
        privacyScore: batch.privacyScore,
        totalSegments: batch.totalSegments,
        completedSegments: batch.completedSegments,
        inputToken: batch.routeMetadata?.inputToken,
        outputToken: batch.routeMetadata?.outputToken,
        totalAmount: batch.routeMetadata?.totalAmount,
        createdAt: batch.createdAt.toISOString(),
        completedAt: batch.actualEndAt?.toISOString(),
      }));
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching routing history:", error);
      res.status(500).json({ error: "Failed to fetch routing history" });
    }
  });

  // Get privacy metrics summary
  app.get("/api/private-routing/metrics", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      
      if (!walletAddress) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }
      
      const summary = await storage.getPrivacyMetricsSummary(walletAddress);
      const batches = await storage.getRoutingBatches(walletAddress);
      
      // Calculate weekly stats
      const weeklyStats: { week: string; transactions: number; avgPrivacyScore: number }[] = [];
      const weekMap = new Map<string, { count: number; totalScore: number }>();
      
      batches.forEach(batch => {
        const week = batch.createdAt.toISOString().slice(0, 10);
        const existing = weekMap.get(week) || { count: 0, totalScore: 0 };
        weekMap.set(week, {
          count: existing.count + 1,
          totalScore: existing.totalScore + batch.privacyScore,
        });
      });
      
      weekMap.forEach((value, week) => {
        weeklyStats.push({
          week,
          transactions: value.count,
          avgPrivacyScore: Math.round((value.totalScore / value.count) * 10) / 10,
        });
      });
      
      weeklyStats.sort((a, b) => b.week.localeCompare(a.week));
      
      res.json({
        ...summary,
        bestPrivacyScore: batches.length > 0 
          ? Math.max(...batches.map(b => b.privacyScore))
          : 0,
        weeklyStats: weeklyStats.slice(0, 8),
      });
    } catch (error) {
      console.error("Error fetching privacy metrics:", error);
      res.status(500).json({ error: "Failed to fetch privacy metrics" });
    }
  });

  // Get detailed batch information
  app.get("/api/private-routing/batch/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const walletAddress = req.query.wallet as string;
      
      const batch = await storage.getRoutingBatch(id);
      if (!batch) {
        res.status(404).json({ error: "Batch not found" });
        return;
      }
      
      if (walletAddress && batch.walletAddress !== walletAddress) {
        res.status(403).json({ error: "Not authorized to view this batch" });
        return;
      }
      
      const segments = await storage.getRoutingSegments(id);
      
      res.json({
        batch,
        segments: segments.map(s => ({
          id: s.id,
          type: s.segmentType,
          index: s.segmentIndex,
          status: s.status,
          tokenSymbol: s.segmentType === "decoy" ? "[MASKED]" : s.tokenSymbol,
          amount: s.segmentType === "decoy" ? null : s.amount,
          scheduledAt: s.scheduledAt,
          executedAt: s.executedAt,
          delayApplied: s.delayAppliedMs,
          commitment: s.commitment,
        })),
      });
    } catch (error) {
      console.error("Error fetching batch details:", error);
      res.status(500).json({ error: "Failed to fetch batch details" });
    }
  });

  // Cancel a scheduled route
  app.post("/api/private-routing/cancel/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { walletAddress } = req.body;
      
      const batch = await storage.getRoutingBatch(id);
      if (!batch) {
        res.status(404).json({ error: "Batch not found" });
        return;
      }
      
      if (batch.walletAddress !== walletAddress) {
        res.status(403).json({ error: "Not authorized to cancel this route" });
        return;
      }
      
      if (!["planning", "scheduled"].includes(batch.status)) {
        res.status(400).json({ error: `Cannot cancel batch with status: ${batch.status}` });
        return;
      }
      
      await storage.updateRoutingBatch(id, {
        status: "cancelled",
        actualEndAt: new Date(),
      });
      
      // Cancel all pending segments
      const segments = await storage.getRoutingSegments(id);
      for (const segment of segments) {
        if (segment.status === "pending") {
          await storage.updateRoutingSegment(segment.id, { status: "skipped" });
        }
      }
      
      await storage.addAuditEntry(
        walletAddress,
        "routing_batch_cancelled",
        `Privacy-enhanced routing batch cancelled`,
        { batchId: id }
      );
      
      res.json({ success: true, message: "Route cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling route:", error);
      res.status(500).json({ error: "Failed to cancel route" });
    }
  });

  // ============================================
  // LIGHT PROTOCOL ZK INTEGRATION ROUTES
  // ============================================

  // Get Light Protocol ZK configuration
  app.get("/api/zk/config", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      if (!walletAddress || walletAddress.length < 32) {
        res.status(400).json({ error: "Valid wallet address required" });
        return;
      }

      let config = await storage.getLightProtocolConfig(walletAddress);
      
      // Create default config if not exists
      if (!config) {
        config = await storage.createLightProtocolConfig({
          walletAddress,
          zkMode: "simulator",
          proofVerificationLevel: "standard",
          autoRefreshInterval: 60,
          maxGasLamports: 10000000,
        });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching ZK config:", error);
      res.status(500).json({ error: "Failed to fetch ZK configuration" });
    }
  });

  // Update Light Protocol ZK configuration
  app.patch("/api/zk/config", async (req, res) => {
    try {
      const { walletAddress, ...updates } = req.body;
      
      if (!walletAddress || walletAddress.length < 32) {
        res.status(400).json({ error: "Valid wallet address required" });
        return;
      }

      // Validate zkMode if provided
      if (updates.zkMode && !["simulator", "zk_enabled"].includes(updates.zkMode)) {
        res.status(400).json({ error: "Invalid zkMode. Must be 'simulator' or 'zk_enabled'" });
        return;
      }

      // Check if config exists
      let config = await storage.getLightProtocolConfig(walletAddress);
      
      if (!config) {
        // Create with defaults and apply updates
        config = await storage.createLightProtocolConfig({
          walletAddress,
          zkMode: updates.zkMode || "simulator",
          proofVerificationLevel: updates.proofVerificationLevel || "standard",
          autoRefreshInterval: updates.autoRefreshInterval ?? 60,
          maxGasLamports: updates.maxGasLamports ?? 10000000,
        });
      } else {
        config = await storage.updateLightProtocolConfig(walletAddress, updates);
      }

      res.json(config);
    } catch (error) {
      console.error("Error updating ZK config:", error);
      res.status(500).json({ error: "Failed to update ZK configuration" });
    }
  });

  // Get ZK capabilities
  app.get("/api/zk/capabilities", async (req, res) => {
    try {
      const { lightProtocolService } = await import("./light-protocol");
      const capabilities = await lightProtocolService.getZkModeCapabilities();
      res.json(capabilities);
    } catch (error) {
      console.error("Error fetching ZK capabilities:", error);
      res.status(500).json({ error: "Failed to fetch ZK capabilities" });
    }
  });

  // Sync state tree for a wallet
  app.post("/api/zk/sync-state", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      
      if (!walletAddress || walletAddress.length < 32) {
        res.status(400).json({ error: "Valid wallet address required" });
        return;
      }

      const { lightProtocolService } = await import("./light-protocol");
      const stateSnapshot = await lightProtocolService.syncStateTree(walletAddress);
      
      // Update config with cached state root
      await storage.updateLightProtocolConfig(walletAddress, {
        cachedStateRoot: stateSnapshot.root,
        lastStateSyncAt: new Date(),
      });

      res.json({
        success: true,
        stateRoot: stateSnapshot.root,
        height: stateSnapshot.height,
        leafCount: stateSnapshot.leafCount,
        isRealData: stateSnapshot.isRealData,
        syncedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error syncing state tree:", error);
      res.status(500).json({ error: "Failed to sync state tree" });
    }
  });

  // Get ZK execution sessions for a wallet
  app.get("/api/zk/sessions", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      
      if (!walletAddress || walletAddress.length < 32) {
        res.status(400).json({ error: "Valid wallet address required" });
        return;
      }

      const sessions = await storage.getZkExecutionSessions(walletAddress);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching ZK sessions:", error);
      res.status(500).json({ error: "Failed to fetch ZK sessions" });
    }
  });

  // Get session by ID
  app.get("/api/zk/session/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getZkExecutionSession(id);
      
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      res.json(session);
    } catch (error) {
      console.error("Error fetching ZK session:", error);
      res.status(500).json({ error: "Failed to fetch ZK session" });
    }
  });

  // Get compressed notes for a wallet
  app.get("/api/zk/notes", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const tokenMint = req.query.tokenMint as string | undefined;
      const activeOnly = req.query.activeOnly === "true";
      
      if (!walletAddress || walletAddress.length < 32) {
        res.status(400).json({ error: "Valid wallet address required" });
        return;
      }

      let notes;
      if (activeOnly) {
        notes = await storage.getActiveCompressedNotes(walletAddress, tokenMint);
      } else {
        notes = await storage.getCompressedNotes(walletAddress);
        if (tokenMint) {
          notes = notes.filter(n => n.tokenMint === tokenMint);
        }
      }

      // Mask sensitive data for response
      const maskedNotes = notes.map(note => ({
        id: note.id,
        tokenMint: note.tokenMint,
        tokenSymbol: note.tokenSymbol,
        status: note.status,
        isDecoy: note.isDecoy,
        leafIndex: note.leafIndex,
        createdAt: note.createdAt,
        spentAt: note.spentAt,
        // Don't expose actual commitment/nullifier to frontend
        hasCommitment: !!note.noteCommitment,
        hasNullifier: !!note.nullifierHash,
      }));

      res.json(maskedNotes);
    } catch (error) {
      console.error("Error fetching compressed notes:", error);
      res.status(500).json({ error: "Failed to fetch compressed notes" });
    }
  });

  // Generate ZK proof for a route segment
  app.post("/api/zk/generate-proof", async (req, res) => {
    try {
      const { walletAddress, batchId, inputToken, outputToken, amount } = req.body;
      
      if (!walletAddress || walletAddress.length < 32) {
        res.status(400).json({ error: "Valid wallet address required" });
        return;
      }

      if (!batchId) {
        res.status(400).json({ error: "Batch ID required" });
        return;
      }

      const config = await storage.getLightProtocolConfig(walletAddress);
      if (!config || config.zkMode !== "zk_enabled") {
        res.status(400).json({ error: "ZK mode not enabled for this wallet" });
        return;
      }

      const { lightProtocolService } = await import("./light-protocol");
      
      // Sync state tree first
      const stateSnapshot = await lightProtocolService.syncStateTree(walletAddress);
      
      // Create ZK execution session
      const session = await storage.createZkExecutionSession({
        walletAddress,
        batchId,
        stateRootSnapshot: stateSnapshot.root,
        proofType: "compressed_transfer",
      });

      // Update session to generating status
      await storage.updateZkExecutionSession(session.id, {
        proofStatus: "generating",
      });

      // Generate ZK route segments with decoys
      const decoyCount = config.autoRefreshInterval ? 3 : 2; // Use config for decoy density
      const zkSegments = await lightProtocolService.generateZkRouteSegments(
        walletAddress,
        inputToken || "SOL",
        outputToken || "USDC",
        amount || 0,
        decoyCount,
        stateSnapshot.root
      );

      // Generate proof
      const proofInput = {
        inputNotes: zkSegments.filter(s => s.type === "real").map(s => s.noteCommitment),
        outputNotes: zkSegments.map(s => s.noteCommitment),
        publicInputs: {
          amount: amount || 0,
          tokenMint: inputToken || "SOL",
          merkleRoot: stateSnapshot.root,
        },
      };

      const proofOutput = await lightProtocolService.generateProof(proofInput);

      // Update session with proof data
      await storage.updateZkExecutionSession(session.id, {
        proofStatus: proofOutput.success ? "generated" : "failed",
        proofData: proofOutput.proofData,
        outputNoteCommitments: proofOutput.outputCommitments,
        nullifiersUsed: proofOutput.nullifiers,
      });

      // Create compressed notes for each segment
      for (const segment of zkSegments) {
        const noteData = await lightProtocolService.createCompressedNote(
          walletAddress,
          inputToken || "SOL",
          segment.type === "real" ? "INPUT" : "DECOY",
          segment.type === "real" ? (amount || 0) : 0,
          stateSnapshot.root,
          segment.type === "decoy"
        );
        
        await storage.createCompressedNote({
          ...noteData,
          sessionId: session.id,
        });
      }

      // Calculate privacy score
      const realCount = zkSegments.filter(s => s.type === "real").length;
      const decoyCountActual = zkSegments.filter(s => s.type === "decoy").length;
      const privacyScore = lightProtocolService.calculatePrivacyScore(
        realCount,
        decoyCountActual,
        0.7, // timing entropy
        0.8  // route diversity
      );

      res.json({
        success: proofOutput.success,
        sessionId: session.id,
        proofStatus: proofOutput.success ? "generated" : "failed",
        privacyScore,
        zkSegments: zkSegments.length,
        realSegments: realCount,
        decoySegments: decoyCountActual,
        stateRoot: stateSnapshot.root,
      });
    } catch (error) {
      console.error("Error generating ZK proof:", error);
      res.status(500).json({ error: "Failed to generate ZK proof" });
    }
  });

  // Verify a ZK proof
  app.post("/api/zk/verify-proof", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        res.status(400).json({ error: "Session ID required" });
        return;
      }

      const session = await storage.getZkExecutionSession(sessionId);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (!session.proofData) {
        res.status(400).json({ error: "No proof data in session" });
        return;
      }

      const { lightProtocolService } = await import("./light-protocol");
      const isValid = await lightProtocolService.verifyProof(session.proofData);

      await storage.updateZkExecutionSession(sessionId, {
        proofStatus: isValid ? "verified" : "failed",
        verificationResult: isValid,
        verificationTimestamp: new Date(),
      });

      res.json({
        success: isValid,
        sessionId,
        verified: isValid,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error verifying ZK proof:", error);
      res.status(500).json({ error: "Failed to verify ZK proof" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
