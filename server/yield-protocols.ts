import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Marinade, MarinadeConfig } from "@marinade.finance/marinade-ts-sdk";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const TATUM_API_KEY = process.env.TATUM_API_KEY;

const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const isTatum = SOLANA_RPC_URL.includes("tatum.io");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  
  if (isTatum && TATUM_API_KEY) {
    headers["x-api-key"] = TATUM_API_KEY;
  }
  
  return fetch(url, { ...options, headers });
};

const connection = new Connection(SOLANA_RPC_URL, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
  fetch: customFetch,
});

export const MSOL_MINT = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
export const MARINADE_PROGRAM = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";

export interface YieldProtocol {
  id: string;
  name: string;
  description: string;
  type: "staking" | "liquidity" | "lending";
  logo: string;
  website: string;
  tvl: number;
  apy: number;
  tokens: string[];
  riskLevel: "low" | "medium" | "high";
  verified: boolean;
  dataSource: "live" | "cached" | "unavailable";
  lastUpdated?: string;
}

export interface YieldPool {
  id: string;
  protocolId: string;
  protocolName: string;
  name: string;
  type: "staking" | "liquidity" | "lending";
  tokenA: string;
  tokenB?: string;
  apy: number;
  tvl: number;
  volume24h: number;
  fees24h: number;
  myPosition?: number;
  rewardToken?: string;
  dataSource: "live" | "unavailable";
}

export interface MarinadeStats {
  tvl: number;
  stakingApy: number;
  msolPrice: number;
  totalMsolSupply: number;
  validators: number;
  dataSource: "live" | "chain" | "unavailable";
}

export interface RaydiumPool {
  id: string;
  name: string;
  mintA: string;
  mintB: string;
  tvl: number;
  apy: number;
  volume24h: number;
  fee: number;
}

export interface OrcaWhirlpool {
  address: string;
  name: string;
  tokenA: string;
  tokenB: string;
  tvl: number;
  apy: number;
  volume24h: number;
  feeRate: number;
}

async function fetchMarinadeStats(): Promise<MarinadeStats | null> {
  try {
    const response = await fetch("https://api.marinade.finance/v1/state", {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      throw new Error(`Marinade API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.tvl_sol && !data.staking_apy) {
      throw new Error("Invalid Marinade API response structure");
    }
    
    return {
      tvl: data.tvl_sol || 0,
      stakingApy: data.staking_apy || 0,
      msolPrice: data.msol_price || 1,
      totalMsolSupply: data.msol_supply || 0,
      validators: data.validators_count || 0,
      dataSource: "live",
    };
  } catch (error) {
    console.error("Error fetching Marinade stats from API:", error);
    return null;
  }
}

async function fetchMarinadeStateFromChain(): Promise<{ msolPrice: number; dataSource: "chain" } | null> {
  try {
    const config = new MarinadeConfig({ connection });
    const marinade = new Marinade(config);
    const state = await marinade.getMarinadeState();
    
    const msolPrice = Number(state.mSolPrice.toString()) / 0x1_0000_0000;
    
    return { msolPrice, dataSource: "chain" };
  } catch (error) {
    console.error("Error fetching Marinade state from chain:", error);
    return null;
  }
}

async function fetchRaydiumPools(): Promise<RaydiumPool[] | null> {
  try {
    const response = await fetch(
      "https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=default&sortType=desc&pageSize=20&page=1",
      {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(15000),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Raydium API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data?.data || !Array.isArray(data.data.data)) {
      throw new Error("Invalid Raydium API response structure");
    }
    
    return data.data.data.slice(0, 15).map((pool: any) => ({
      id: pool.id,
      name: `${pool.mintA?.symbol || 'Unknown'}/${pool.mintB?.symbol || 'Unknown'}`,
      mintA: pool.mintA?.address || "",
      mintB: pool.mintB?.address || "",
      tvl: pool.tvl || 0,
      apy: (pool.day?.apr || 0) * 100,
      volume24h: pool.day?.volume || 0,
      fee: pool.day?.feeApr || 0,
    }));
  } catch (error) {
    console.error("Error fetching Raydium pools:", error);
    return null;
  }
}

async function fetchOrcaPools(): Promise<OrcaWhirlpool[] | null> {
  try {
    const response = await fetch(
      "https://api.orca.so/v2/whirlpools?whirlpoolsConfig=whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
      {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(15000),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Orca API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error("Invalid Orca API response structure");
    }
    
    return data.slice(0, 15).map((pool: any) => ({
      address: pool.address,
      name: `${pool.tokenA?.symbol || 'Unknown'}/${pool.tokenB?.symbol || 'Unknown'}`,
      tokenA: pool.tokenA?.mint || "",
      tokenB: pool.tokenB?.mint || "",
      tvl: pool.tvl || 0,
      apy: (pool.apr?.total || 0) * 100,
      volume24h: pool.volume24h || 0,
      feeRate: pool.feeRate || 0,
    }));
  } catch (error) {
    console.error("Error fetching Orca pools:", error);
    return null;
  }
}

export async function getAllProtocols(): Promise<YieldProtocol[]> {
  const [marinadeStats, raydiumPools, orcaPools] = await Promise.all([
    fetchMarinadeStats(),
    fetchRaydiumPools(),
    fetchOrcaPools(),
  ]);
  
  const protocols: YieldProtocol[] = [];
  const timestamp = new Date().toISOString();
  
  if (marinadeStats) {
    const solPrice = 200;
    protocols.push({
      id: "marinade",
      name: "Marinade Finance",
      description: "Liquid staking protocol - Stake SOL, receive mSOL",
      type: "staking",
      logo: "https://raw.githubusercontent.com/marinade-finance/marinade-assets/main/logo.png",
      website: "https://marinade.finance",
      tvl: marinadeStats.tvl * solPrice,
      apy: marinadeStats.stakingApy,
      tokens: ["SOL", "mSOL"],
      riskLevel: "low",
      verified: true,
      dataSource: "live",
      lastUpdated: timestamp,
    });
  } else {
    protocols.push({
      id: "marinade",
      name: "Marinade Finance",
      description: "Liquid staking protocol - Stake SOL, receive mSOL",
      type: "staking",
      logo: "https://raw.githubusercontent.com/marinade-finance/marinade-assets/main/logo.png",
      website: "https://marinade.finance",
      tvl: 0,
      apy: 0,
      tokens: ["SOL", "mSOL"],
      riskLevel: "low",
      verified: true,
      dataSource: "unavailable",
      lastUpdated: timestamp,
    });
  }
  
  if (raydiumPools && raydiumPools.length > 0) {
    const raydiumTvl = raydiumPools.reduce((sum, p) => sum + p.tvl, 0);
    const raydiumAvgApy = raydiumPools.reduce((sum, p) => sum + p.apy, 0) / raydiumPools.length;
    
    protocols.push({
      id: "raydium",
      name: "Raydium",
      description: "AMM & liquidity provider on Solana",
      type: "liquidity",
      logo: "https://raydium.io/icons/logo.svg",
      website: "https://raydium.io",
      tvl: raydiumTvl,
      apy: raydiumAvgApy,
      tokens: ["SOL", "USDC", "RAY", "USDT"],
      riskLevel: "medium",
      verified: true,
      dataSource: "live",
      lastUpdated: timestamp,
    });
  } else {
    protocols.push({
      id: "raydium",
      name: "Raydium",
      description: "AMM & liquidity provider on Solana",
      type: "liquidity",
      logo: "https://raydium.io/icons/logo.svg",
      website: "https://raydium.io",
      tvl: 0,
      apy: 0,
      tokens: ["SOL", "USDC", "RAY", "USDT"],
      riskLevel: "medium",
      verified: true,
      dataSource: "unavailable",
      lastUpdated: timestamp,
    });
  }
  
  if (orcaPools && orcaPools.length > 0) {
    const orcaTvl = orcaPools.reduce((sum, p) => sum + p.tvl, 0);
    const orcaAvgApy = orcaPools.reduce((sum, p) => sum + p.apy, 0) / orcaPools.length;
    
    protocols.push({
      id: "orca",
      name: "Orca",
      description: "Concentrated liquidity DEX (Whirlpools)",
      type: "liquidity",
      logo: "https://www.orca.so/favicon.ico",
      website: "https://www.orca.so",
      tvl: orcaTvl,
      apy: orcaAvgApy,
      tokens: ["SOL", "USDC", "mSOL", "BONK"],
      riskLevel: "medium",
      verified: true,
      dataSource: "live",
      lastUpdated: timestamp,
    });
  } else {
    protocols.push({
      id: "orca",
      name: "Orca",
      description: "Concentrated liquidity DEX (Whirlpools)",
      type: "liquidity",
      logo: "https://www.orca.so/favicon.ico",
      website: "https://www.orca.so",
      tvl: 0,
      apy: 0,
      tokens: ["SOL", "USDC", "mSOL", "BONK"],
      riskLevel: "medium",
      verified: true,
      dataSource: "unavailable",
      lastUpdated: timestamp,
    });
  }
  
  return protocols;
}

export async function getAllPools(): Promise<YieldPool[]> {
  const [marinadeStats, raydiumPools, orcaPools] = await Promise.all([
    fetchMarinadeStats(),
    fetchRaydiumPools(),
    fetchOrcaPools(),
  ]);
  
  const pools: YieldPool[] = [];
  
  if (marinadeStats && marinadeStats.stakingApy > 0) {
    pools.push({
      id: "marinade-sol-staking",
      protocolId: "marinade",
      protocolName: "Marinade Finance",
      name: "SOL Staking (mSOL)",
      type: "staking",
      tokenA: "SOL",
      apy: marinadeStats.stakingApy,
      tvl: marinadeStats.tvl * 200,
      volume24h: 0,
      fees24h: 0,
      rewardToken: "mSOL",
      dataSource: "live",
    });
  }
  
  if (raydiumPools && raydiumPools.length > 0) {
    for (const pool of raydiumPools) {
      if (pool.tvl > 0 || pool.apy > 0) {
        pools.push({
          id: `raydium-${pool.id}`,
          protocolId: "raydium",
          protocolName: "Raydium",
          name: pool.name,
          type: "liquidity",
          tokenA: pool.name.split("/")[0],
          tokenB: pool.name.split("/")[1],
          apy: pool.apy,
          tvl: pool.tvl,
          volume24h: pool.volume24h,
          fees24h: pool.volume24h * (pool.fee / 100),
          rewardToken: "RAY",
          dataSource: "live",
        });
      }
    }
  }
  
  if (orcaPools && orcaPools.length > 0) {
    for (const pool of orcaPools) {
      if (pool.tvl > 0 || pool.apy > 0) {
        pools.push({
          id: `orca-${pool.address}`,
          protocolId: "orca",
          protocolName: "Orca Whirlpools",
          name: pool.name,
          type: "liquidity",
          tokenA: pool.name.split("/")[0],
          tokenB: pool.name.split("/")[1],
          apy: pool.apy,
          tvl: pool.tvl,
          volume24h: pool.volume24h,
          fees24h: pool.volume24h * pool.feeRate,
          dataSource: "live",
        });
      }
    }
  }
  
  return pools;
}

export async function getMarinadeInfo(): Promise<{
  stats: MarinadeStats | null;
  chainState: { msolPrice: number } | null;
}> {
  const [stats, chainState] = await Promise.all([
    fetchMarinadeStats(),
    fetchMarinadeStateFromChain(),
  ]);
  
  return { 
    stats, 
    chainState: chainState ? { msolPrice: chainState.msolPrice } : null 
  };
}

export async function getMsolBalance(walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const msolMint = new PublicKey(MSOL_MINT);
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      mint: msolMint,
    });
    
    if (tokenAccounts.value.length > 0) {
      return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
    }
    
    return 0;
  } catch (error) {
    console.error("Error fetching mSOL balance:", error);
    return 0;
  }
}

export async function buildMarinadeStakeTransaction(
  walletAddress: string,
  amountSol: number
): Promise<{ transaction: any; msolAmount: number } | null> {
  try {
    const config = new MarinadeConfig({
      connection,
      publicKey: new PublicKey(walletAddress),
    });
    const marinade = new Marinade(config);
    
    const amountLamports = BigInt(Math.floor(amountSol * LAMPORTS_PER_SOL));
    
    const { transaction } = await marinade.deposit(amountLamports);
    
    const state = await marinade.getMarinadeState();
    const msolPrice = Number(state.mSolPrice.toString()) / 0x1_0000_0000;
    const msolAmount = amountSol / msolPrice;
    
    return {
      transaction,
      msolAmount,
    };
  } catch (error) {
    console.error("Error building Marinade stake transaction:", error);
    return null;
  }
}

export async function buildMarinadeUnstakeTransaction(
  walletAddress: string,
  amountMsol: number,
  instant: boolean = true
): Promise<{ transaction: any; solAmount: number } | null> {
  try {
    const config = new MarinadeConfig({
      connection,
      publicKey: new PublicKey(walletAddress),
    });
    const marinade = new Marinade(config);
    
    const amountLamports = BigInt(Math.floor(amountMsol * LAMPORTS_PER_SOL));
    
    const state = await marinade.getMarinadeState();
    const msolPrice = Number(state.mSolPrice.toString()) / 0x1_0000_0000;
    const solAmount = amountMsol * msolPrice;
    
    let transaction;
    if (instant) {
      const result = await marinade.liquidUnstake(amountLamports);
      transaction = result.transaction;
    } else {
      const result = await (marinade as any).delayedUnstake(amountLamports);
      transaction = result.transaction;
    }
    
    return {
      transaction,
      solAmount,
    };
  } catch (error) {
    console.error("Error building Marinade unstake transaction:", error);
    return null;
  }
}

export const yieldProtocolsService = {
  getAllProtocols,
  getAllPools,
  getMarinadeInfo,
  getMsolBalance,
  buildMarinadeStakeTransaction,
  buildMarinadeUnstakeTransaction,
  fetchMarinadeStats,
  fetchRaydiumPools,
  fetchOrcaPools,
};

export default yieldProtocolsService;
