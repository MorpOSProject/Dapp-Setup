import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL, 
  Transaction, 
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

// Use free public Solana RPC (Tatum in env var has strict rate limits on free tier)
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

const connection = new Connection(SOLANA_RPC_URL, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
});

// Token mints for supported tokens
export const TOKEN_MINTS: Record<string, { mint: string; decimals: number; symbol: string; name: string }> = {
  SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9, symbol: "SOL", name: "Solana" },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, symbol: "USDC", name: "USD Coin" },
  RAY: { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, symbol: "RAY", name: "Raydium" },
  BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, symbol: "BONK", name: "Bonk" },
  JUP: { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, symbol: "JUP", name: "Jupiter" },
  PYTH: { mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, symbol: "PYTH", name: "Pyth Network" },
};

export const MINT_TO_SYMBOL: Record<string, string> = Object.entries(TOKEN_MINTS).reduce(
  (acc, [symbol, data]) => ({ ...acc, [data.mint]: symbol }),
  {}
);

// Fetch SOL balance for a wallet
export async function getSolBalance(walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error fetching SOL balance:", error);
    return 0;
  }
}

// Fetch token balances for a wallet using RPC
export async function getTokenBalances(walletAddress: string): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  
  try {
    const publicKey = new PublicKey(walletAddress);
    console.log(`Fetching balances for wallet: ${walletAddress}`);
    
    // Get SOL balance
    const solBalance = await getSolBalance(walletAddress);
    console.log(`SOL balance: ${solBalance}`);
    if (solBalance > 0) {
      balances.set(TOKEN_MINTS.SOL.mint, solBalance);
    }
    
    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    
    console.log(`Found ${tokenAccounts.value.length} token accounts`);
    
    for (const account of tokenAccounts.value) {
      const tokenData = account.account.data.parsed.info;
      const mint = tokenData.mint;
      const balance = tokenData.tokenAmount.uiAmount;
      
      if (balance > 0) {
        balances.set(mint, balance);
        console.log(`Token ${mint}: ${balance}`);
      }
    }
  } catch (error) {
    console.error("Error fetching token balances:", error);
  }
  
  console.log(`Total balances found: ${balances.size}`);
  return balances;
}

// Fetch token prices from Jupiter API
export async function getTokenPrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  // Always set fallback prices first
  prices.set(TOKEN_MINTS.SOL.mint, 200);
  prices.set(TOKEN_MINTS.USDC.mint, 1);
  prices.set(TOKEN_MINTS.RAY.mint, 2.5);
  prices.set(TOKEN_MINTS.BONK.mint, 0.000025);
  prices.set(TOKEN_MINTS.JUP.mint, 1.2);
  prices.set(TOKEN_MINTS.PYTH.mint, 0.45);
  
  try {
    const mintList = mints.join(",");
    console.log(`Fetching prices for ${mints.length} tokens`);
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${mintList}`);
    const data = await response.json();
    
    if (data.data) {
      for (const [mint, priceData] of Object.entries(data.data)) {
        if ((priceData as any)?.price) {
          prices.set(mint, parseFloat((priceData as any).price));
          console.log(`Price for ${mint}: $${(priceData as any).price}`);
        }
      }
    }
    console.log(`Prices fetched: ${prices.size}`);
  } catch (error) {
    console.error("Error fetching token prices:", error);
  }
  
  return prices;
}

// Jupiter API base URL - using public lite endpoint (no auth required)
const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1";
const JUPITER_SWAP_API = "https://lite-api.jup.ag/swap/v1";

// Get Jupiter swap quote
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  inputDecimals: number,
  slippageBps: number = 50
): Promise<any> {
  try {
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, inputDecimals));
    
    const quoteUrl = `${JUPITER_QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnit}&slippageBps=${slippageBps}`;
    console.log("Fetching Jupiter quote from:", quoteUrl);
    
    const response = await fetch(quoteUrl, {
      headers: {
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Jupiter quote API error:", response.status, errorText);
      throw new Error(`Jupiter API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log("Jupiter quote received successfully");
    return data;
  } catch (error) {
    console.error("Error fetching Jupiter quote:", error);
    return null;
  }
}

// Get multiple token info at once
export async function getWalletTokenData(walletAddress: string) {
  const balances = await getTokenBalances(walletAddress);
  const mints = Array.from(balances.keys());
  
  // Add all known mints to fetch their prices even if balance is 0
  for (const tokenData of Object.values(TOKEN_MINTS)) {
    if (!mints.includes(tokenData.mint)) {
      mints.push(tokenData.mint);
    }
  }
  
  const prices = await getTokenPrices(mints);
  
  const holdings: Array<{
    mint: string;
    symbol: string;
    name: string;
    balance: number;
    price: number;
    valueUsd: number;
  }> = [];
  
  for (const entry of Array.from(balances.entries())) {
    const [mint, balance] = entry;
    const symbol = MINT_TO_SYMBOL[mint] || "UNKNOWN";
    const tokenInfo = TOKEN_MINTS[symbol];
    const price = prices.get(mint) || 0;
    
    holdings.push({
      mint,
      symbol: tokenInfo?.symbol || symbol,
      name: tokenInfo?.name || symbol,
      balance,
      price,
      valueUsd: balance * price,
    });
  }
  
  // Sort by value
  holdings.sort((a, b) => b.valueUsd - a.valueUsd);
  
  return { holdings, prices };
}

// Get token info by mint
export function getTokenInfo(mint: string) {
  const symbol = MINT_TO_SYMBOL[mint];
  if (symbol && TOKEN_MINTS[symbol]) {
    return TOKEN_MINTS[symbol];
  }
  return null;
}

// Get Jupiter swap transaction - returns serialized transaction for wallet signing
export async function getJupiterSwapTransaction(
  quoteResponse: any,
  userPublicKey: string
): Promise<{ swapTransaction: string; lastValidBlockHeight: number } | null> {
  try {
    const swapUrl = `${JUPITER_SWAP_API}/swap`;
    console.log("Requesting Jupiter swap transaction for wallet:", userPublicKey);
    
    const response = await fetch(swapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Jupiter swap API error:", response.status, error);
      throw new Error(`Jupiter swap API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log("Jupiter swap transaction received, lastValidBlockHeight:", data.lastValidBlockHeight);
    
    return {
      swapTransaction: data.swapTransaction,
      lastValidBlockHeight: data.lastValidBlockHeight,
    };
  } catch (error) {
    console.error("Error getting Jupiter swap transaction:", error);
    return null;
  }
}

// Verify transaction confirmation on-chain
export async function confirmTransaction(
  signature: string,
  maxRetries: number = 30
): Promise<{ confirmed: boolean; slot?: number; error?: string }> {
  try {
    for (let i = 0; i < maxRetries; i++) {
      const status = await connection.getSignatureStatus(signature);
      
      if (status.value?.confirmationStatus === "confirmed" || 
          status.value?.confirmationStatus === "finalized") {
        return { 
          confirmed: true, 
          slot: status.context.slot 
        };
      }
      
      if (status.value?.err) {
        return { 
          confirmed: false, 
          error: JSON.stringify(status.value.err) 
        };
      }
      
      // Wait 500ms before next check
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { confirmed: false, error: "Transaction confirmation timeout" };
  } catch (error) {
    console.error("Error confirming transaction:", error);
    return { confirmed: false, error: String(error) };
  }
}

// Get recent blockhash for transaction
export async function getRecentBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  return { blockhash, lastValidBlockHeight };
}

// Export connection for use in routes
export { connection };

// ============ ESCROW WALLET FOR STEALTH PAYMENTS ============

// Get escrow keypair from environment variable
function getEscrowKeypair(): Keypair | null {
  const privateKeyBase58 = process.env.ESCROW_PRIVATE_KEY;
  if (!privateKeyBase58) {
    console.error("ESCROW_PRIVATE_KEY not set");
    return null;
  }
  try {
    const privateKeyBytes = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    console.error("Invalid ESCROW_PRIVATE_KEY format:", error);
    return null;
  }
}

// Get escrow wallet public key
export function getEscrowPublicKey(): string | null {
  const keypair = getEscrowKeypair();
  return keypair ? keypair.publicKey.toBase58() : null;
}

// Check if token account exists
async function tokenAccountExists(owner: PublicKey, mint: PublicKey): Promise<boolean> {
  try {
    const ata = await getAssociatedTokenAddress(mint, owner);
    await getAccount(connection, ata);
    return true;
  } catch {
    return false;
  }
}

// Build transaction for sender to deposit tokens to escrow
// Returns serialized transaction for frontend to sign
export async function buildStealthDepositTransaction(
  senderWallet: string,
  tokenMint: string,
  amount: number,
  decimals: number
): Promise<{ transaction: string; escrowWallet: string } | null> {
  try {
    const escrowKeypair = getEscrowKeypair();
    if (!escrowKeypair) {
      throw new Error("Escrow wallet not configured");
    }

    const sender = new PublicKey(senderWallet);
    const escrow = escrowKeypair.publicKey;
    const mint = new PublicKey(tokenMint);
    const isSol = tokenMint === TOKEN_MINTS.SOL.mint;

    const transaction = new Transaction();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = sender;

    if (isSol) {
      // Native SOL transfer
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: escrow,
          lamports,
        })
      );
    } else {
      // SPL token transfer
      const senderAta = await getAssociatedTokenAddress(mint, sender);
      const escrowAta = await getAssociatedTokenAddress(mint, escrow);
      
      // Create escrow ATA if needed
      const escrowAtaExists = await tokenAccountExists(escrow, mint);
      if (!escrowAtaExists) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            sender, // payer
            escrowAta,
            escrow,
            mint
          )
        );
      }
      
      const tokenAmount = Math.floor(amount * Math.pow(10, decimals));
      transaction.add(
        createTransferInstruction(
          senderAta,
          escrowAta,
          sender,
          BigInt(tokenAmount)
        )
      );
    }

    // Serialize transaction (without signatures)
    const serialized = transaction.serialize({ 
      requireAllSignatures: false,
      verifySignatures: false 
    });
    
    return {
      transaction: serialized.toString("base64"),
      escrowWallet: escrow.toBase58(),
    };
  } catch (error) {
    console.error("Error building stealth deposit transaction:", error);
    return null;
  }
}

// Build claim transaction where claimer pays fees (returns partially signed tx)
export async function buildClaimTransaction(
  claimerWallet: string,
  tokenMint: string,
  amount: number,
  decimals: number
): Promise<{ transaction: string; blockhash: string; lastValidBlockHeight: number } | null> {
  try {
    const escrowKeypair = getEscrowKeypair();
    if (!escrowKeypair) {
      throw new Error("Escrow wallet not configured");
    }

    const claimer = new PublicKey(claimerWallet);
    const escrow = escrowKeypair.publicKey;
    const mint = new PublicKey(tokenMint);
    const isSol = tokenMint === TOKEN_MINTS.SOL.mint;

    const transaction = new Transaction();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = claimer; // Claimer pays the fee!

    if (isSol) {
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: escrow,
          toPubkey: claimer,
          lamports,
        })
      );
    } else {
      const escrowAta = await getAssociatedTokenAddress(mint, escrow);
      const claimerAta = await getAssociatedTokenAddress(mint, claimer);
      
      // Create claimer ATA if needed (claimer pays)
      const claimerAtaExists = await tokenAccountExists(claimer, mint);
      if (!claimerAtaExists) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            claimer, // claimer pays for their own ATA
            claimerAta,
            claimer,
            mint
          )
        );
      }
      
      const tokenAmount = Math.floor(amount * Math.pow(10, decimals));
      transaction.add(
        createTransferInstruction(
          escrowAta,
          claimerAta,
          escrow, // escrow authorizes the transfer
          BigInt(tokenAmount)
        )
      );
    }

    // Escrow partially signs (authorizes token release)
    transaction.partialSign(escrowKeypair);

    const serialized = transaction.serialize({ 
      requireAllSignatures: false,
      verifySignatures: false 
    });

    console.log("Built claim transaction for claimer:", claimer.toBase58());
    return { 
      transaction: serialized.toString("base64"),
      blockhash,
      lastValidBlockHeight
    };
  } catch (error) {
    console.error("Error building claim transaction:", error);
    return null;
  }
}

// Execute claim after claimer signs
export async function executeClaimTransaction(
  signedTransaction: string
): Promise<{ signature: string } | null> {
  try {
    const txBuffer = Buffer.from(signedTransaction, "base64");
    const transaction = Transaction.from(txBuffer);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log("Claim transaction sent:", signature);

    // Quick confirmation
    for (let i = 0; i < 10; i++) {
      try {
        const status = await connection.getSignatureStatus(signature);
        if (status?.value?.confirmationStatus === "confirmed" || 
            status?.value?.confirmationStatus === "finalized") {
          if (status.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
          }
          console.log("Claim transaction confirmed:", signature);
          return { signature };
        }
      } catch (e) {
        // Continue checking
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("Claim sent (confirmation timeout):", signature);
    return { signature };
  } catch (error) {
    console.error("Error executing claim transaction:", error);
    return null;
  }
}

// Get escrow balance for a specific token
export async function getEscrowBalance(tokenMint: string): Promise<number> {
  try {
    const escrowKeypair = getEscrowKeypair();
    if (!escrowKeypair) return 0;

    const escrow = escrowKeypair.publicKey;
    const mint = new PublicKey(tokenMint);
    const isSol = tokenMint === TOKEN_MINTS.SOL.mint;

    if (isSol) {
      const balance = await connection.getBalance(escrow);
      return balance / LAMPORTS_PER_SOL;
    } else {
      const ata = await getAssociatedTokenAddress(mint, escrow);
      try {
        const account = await getAccount(connection, ata);
        const tokenInfo = getTokenInfo(tokenMint);
        const decimals = tokenInfo?.decimals || 6;
        return Number(account.amount) / Math.pow(10, decimals);
      } catch {
        return 0;
      }
    }
  } catch (error) {
    console.error("Error getting escrow balance:", error);
    return 0;
  }
}
