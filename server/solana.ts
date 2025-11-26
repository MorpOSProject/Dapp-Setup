import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Use environment variable or fallback to public RPC
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Custom fetch with Tatum API key if using Tatum
const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const isTatum = SOLANA_RPC_URL.includes("tatum.io");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  
  // Add Tatum API key from URL if present
  if (isTatum) {
    // Tatum API key should be in the SOLANA_RPC_URL or separate env var
    const apiKey = process.env.TATUM_API_KEY;
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }
  }
  
  return fetch(url, { ...options, headers });
};

const connection = new Connection(SOLANA_RPC_URL, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
  fetch: customFetch,
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
