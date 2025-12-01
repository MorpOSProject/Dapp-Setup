import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWalletContext } from "@/components/wallet-provider";
import { 
  TrendingUp, 
  Shield,
  Wallet,
  Coins,
  Droplets,
  Lock,
  RefreshCw,
  ExternalLink,
  Info,
  Zap,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Globe
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { YieldStrategy } from "@shared/schema";
import { TokenLogo } from "@/components/token-logo";

interface YieldProtocol {
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
  dataSource?: "live" | "unavailable";
}

interface YieldPool {
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
  dataSource?: "live" | "unavailable";
}

interface MarinadeInfo {
  stats: {
    tvl: number;
    stakingApy: number;
    msolPrice: number;
    totalMsolSupply: number;
    validators: number;
    dataSource?: "live" | "chain" | "unavailable";
  } | null;
  chainState: {
    msolPrice: number;
  } | null;
  msolBalance: number;
  dataSource?: "live" | "chain" | "unavailable";
  lastUpdated?: string;
}

function formatCurrency(value: number): string {
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(2)}B`;
  }
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 4): string {
  if (value < 0.0001 && value > 0) return "<0.0001";
  return value.toLocaleString("en-US", { 
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals 
  });
}

function ProtocolCard({ protocol, onClick }: { protocol: YieldProtocol; onClick: () => void }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "staking": return <Lock className="w-4 h-4" />;
      case "liquidity": return <Droplets className="w-4 h-4" />;
      case "lending": return <Coins className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const isDataUnavailable = protocol.dataSource === "unavailable" || protocol.tvl === 0;

  return (
    <Card 
      className={`hover-elevate cursor-pointer ${isDataUnavailable ? "opacity-60" : ""}`} 
      onClick={onClick} 
      data-testid={`protocol-card-${protocol.id}`}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-cyan-500/20 flex items-center justify-center font-bold text-lg text-primary">
              {protocol.name.slice(0, 2)}
            </div>
            <div>
              <h4 className="font-medium flex items-center gap-2">
                {protocol.name}
                {protocol.verified && !isDataUnavailable && (
                  <CheckCircle className="w-4 h-4 text-success" />
                )}
                {isDataUnavailable && (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
              </h4>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {getTypeIcon(protocol.type)}
                <span className="capitalize">{protocol.type}</span>
              </p>
            </div>
          </div>
          <Badge 
            variant={
              protocol.riskLevel === "low" ? "outline" : 
              protocol.riskLevel === "medium" ? "secondary" : "destructive"
            }
            className="text-xs capitalize"
          >
            {protocol.riskLevel}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {protocol.description}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">TVL</p>
            {isDataUnavailable ? (
              <p className="font-mono text-sm text-muted-foreground">Data unavailable</p>
            ) : (
              <p className="font-mono font-medium">{formatCurrency(protocol.tvl)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">APY</p>
            {isDataUnavailable ? (
              <p className="font-mono text-sm text-muted-foreground">--</p>
            ) : (
              <p className="font-mono font-medium text-success flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {protocol.apy.toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {protocol.tokens.slice(0, 4).map((token) => (
            <Badge key={token} variant="outline" className="text-xs flex items-center gap-1.5 pl-1">
              <TokenLogo symbol={token} size="xs" />
              {token}
            </Badge>
          ))}
          {protocol.dataSource === "live" && (
            <Badge variant="outline" className="text-xs text-success border-success/30">
              Live
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PoolCard({ pool }: { pool: YieldPool }) {
  return (
    <Card className="hover-elevate" data-testid={`pool-card-${pool.id}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h4 className="font-medium">{pool.name}</h4>
            <p className="text-sm text-muted-foreground">{pool.protocolName}</p>
          </div>
          <div className="flex items-center gap-2">
            {pool.dataSource === "live" && (
              <Badge variant="outline" className="text-xs text-success border-success/30">
                Live
              </Badge>
            )}
            <Badge variant="outline" className="capitalize text-xs">
              {pool.type}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">APY</p>
            <p className="font-mono text-success font-medium">{pool.apy.toFixed(1)}%</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">TVL</p>
            <p className="font-mono font-medium text-sm">{formatCurrency(pool.tvl)}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">24h Vol</p>
            <p className="font-mono font-medium text-sm">{formatCurrency(pool.volume24h)}</p>
          </div>
        </div>

        {pool.rewardToken && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="w-4 h-4" />
            Rewards in {pool.rewardToken}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarinadeStakingCard({ marinadeInfo, onStake }: { marinadeInfo: MarinadeInfo; onStake: () => void }) {
  const hasStats = marinadeInfo.stats && marinadeInfo.stats.stakingApy > 0;
  const chainPrice = marinadeInfo.chainState?.msolPrice || marinadeInfo.stats?.msolPrice || 1;
  const solPrice = 200;
  
  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-cyan-500/5">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-white font-bold">
              M
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Marinade Finance
                {hasStats ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
              </CardTitle>
              <CardDescription>Liquid Staking - Stake SOL, receive mSOL</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {marinadeInfo.dataSource === "live" && (
              <Badge variant="outline" className="text-xs text-success border-success/30">
                Live
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">Low Risk</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasStats && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span>Live data temporarily unavailable. Data may be outdated.</span>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-background rounded-lg">
            <p className="text-xs text-muted-foreground">Staking APY</p>
            {hasStats && marinadeInfo.stats ? (
              <p className="text-xl font-bold text-success">{marinadeInfo.stats.stakingApy.toFixed(1)}%</p>
            ) : (
              <p className="text-xl font-bold text-muted-foreground">--</p>
            )}
          </div>
          <div className="p-3 bg-background rounded-lg">
            <p className="text-xs text-muted-foreground">Total Staked</p>
            {hasStats && marinadeInfo.stats ? (
              <p className="text-xl font-bold">{formatCurrency(marinadeInfo.stats.tvl * solPrice)}</p>
            ) : (
              <p className="text-xl font-bold text-muted-foreground">--</p>
            )}
          </div>
          <div className="p-3 bg-background rounded-lg">
            <p className="text-xs text-muted-foreground">mSOL Price</p>
            <p className="text-xl font-bold">{chainPrice.toFixed(4)} SOL</p>
          </div>
          <div className="p-3 bg-background rounded-lg">
            <p className="text-xs text-muted-foreground">Validators</p>
            {hasStats && marinadeInfo.stats ? (
              <p className="text-xl font-bold">{marinadeInfo.stats.validators}</p>
            ) : (
              <p className="text-xl font-bold text-muted-foreground">--</p>
            )}
          </div>
        </div>

        {marinadeInfo.msolBalance > 0 && (
          <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Your mSOL Balance</p>
                <p className="text-2xl font-bold">{formatNumber(marinadeInfo.msolBalance)} mSOL</p>
                <p className="text-sm text-muted-foreground">
                  ≈ {formatNumber(marinadeInfo.msolBalance * chainPrice)} SOL
                </p>
              </div>
              <Shield className="w-8 h-8 text-success" />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-privacy" />
          <span>Staking through MORP OS maintains privacy via shadow balances</span>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button className="flex-1" onClick={onStake} data-testid="button-stake-marinade">
          <Lock className="w-4 h-4 mr-2" />
          Stake SOL
        </Button>
        <Button variant="outline" asChild>
          <a href="https://marinade.finance" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

function StakeDialog({ 
  open, 
  onClose, 
  marinadeInfo 
}: { 
  open: boolean; 
  onClose: () => void; 
  marinadeInfo: MarinadeInfo | undefined;
}) {
  const { publicKey } = useWalletContext();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  
  const stakeMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; amount: number }) => {
      return apiRequest("POST", "/api/yield/marinade/stake", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Stake Initiated",
        description: `Staking ${amount} SOL → ~${data.expectedMsol?.toFixed(4) || '?'} mSOL`,
      });
      onClose();
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/yield/marinade"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yield/strategies"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to initiate stake",
        variant: "destructive",
      });
    },
  });

  const handleStake = () => {
    if (!publicKey || !amount || parseFloat(amount) <= 0) return;
    stakeMutation.mutate({ walletAddress: publicKey, amount: parseFloat(amount) });
  };

  const msolPrice = marinadeInfo?.chainState?.msolPrice || marinadeInfo?.stats?.msolPrice || 1.08;
  const stakingApy = marinadeInfo?.stats?.stakingApy || 6.5;
  const expectedMsol = parseFloat(amount || "0") / msolPrice;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stake SOL with Marinade</DialogTitle>
          <DialogDescription>
            Stake SOL to receive mSOL - a liquid staking token that earns ~{stakingApy.toFixed(1)}% APY
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (SOL)</label>
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-stake-amount"
            />
          </div>

          {parseFloat(amount) > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">You will receive</span>
                <span className="font-mono font-medium">~{expectedMsol.toFixed(4)} mSOL</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Exchange rate</span>
                <span className="font-mono">1 mSOL = {msolPrice.toFixed(4)} SOL</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Est. yearly earnings</span>
                <span className="font-mono text-success">
                  +{(parseFloat(amount) * stakingApy / 100).toFixed(4)} SOL
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-privacy" />
            <span>This stake will be tracked in your shadow balance</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleStake} 
            disabled={!amount || parseFloat(amount) <= 0 || stakeMutation.isPending}
            data-testid="button-confirm-stake"
          >
            {stakeMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Staking...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Stake SOL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StrategyCard({ strategy }: { strategy: YieldStrategy }) {
  const pnl = (strategy.currentValue || 0) - (strategy.depositAmount || 0);
  const pnlPercent = strategy.depositAmount ? (pnl / strategy.depositAmount) * 100 : 0;
  
  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
              {strategy.protocol?.slice(0, 2) || "YF"}
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {strategy.name}
                {strategy.isPrivate && (
                  <Shield className="w-4 h-4 text-privacy" />
                )}
              </CardTitle>
              <CardDescription>{strategy.protocol}</CardDescription>
            </div>
          </div>
          <Badge 
            variant={strategy.status === "active" ? "default" : "secondary"}
            className="capitalize"
          >
            {strategy.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Deposited</p>
            <p className="font-mono font-medium">
              {formatNumber(strategy.depositAmount || 0)} {strategy.depositToken || "SOL"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="font-mono font-medium">
              {formatCurrency(strategy.currentValue || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">APY</p>
            <p className="font-mono font-medium text-success flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {(strategy.apy || 0).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rewards</p>
            <p className="font-mono font-medium">
              {formatNumber(strategy.rewards || 0)} {strategy.rewardsToken || ""}
            </p>
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">P&L</span>
            <span className={pnl >= 0 ? "text-success" : "text-destructive"}>
              {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" className="flex-1" data-testid={`button-withdraw-${strategy.id}`}>
          Withdraw
        </Button>
        <Button variant="outline" size="sm" className="flex-1" data-testid={`button-claim-${strategy.id}`}>
          <Coins className="w-4 h-4 mr-1" />
          Claim
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function YieldPage() {
  const { connected, publicKey } = useWalletContext();
  const [stakeDialogOpen, setStakeDialogOpen] = useState(false);

  const { data: protocols, isLoading: protocolsLoading } = useQuery<YieldProtocol[]>({
    queryKey: ["/api/yield/protocols"],
  });

  const { data: pools, isLoading: poolsLoading } = useQuery<YieldPool[]>({
    queryKey: ["/api/yield/pools"],
  });

  const { data: marinadeInfo, isLoading: marinadeLoading } = useQuery<MarinadeInfo>({
    queryKey: ["/api/yield/marinade", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const { data: strategies, isLoading: strategiesLoading } = useQuery<YieldStrategy[]>({
    queryKey: ["/api/yield/strategies", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  if (!connected) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Yield Farming</h1>
          <p className="text-muted-foreground">
            Earn yield on your crypto with privacy protection
          </p>
        </div>
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-12 pb-12 text-center">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Connect Wallet</h3>
            <p className="text-muted-foreground">
              Connect your wallet to access yield farming opportunities
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Yield Farming</h1>
          <p className="text-muted-foreground">
            Real DeFi yields from Marinade, Raydium, and Orca
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Globe className="w-3 h-3" />
            Mainnet
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Shield className="w-3 h-3" />
            Privacy Enabled
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="opportunities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="opportunities" data-testid="tab-opportunities">
            Opportunities
          </TabsTrigger>
          <TabsTrigger value="pools" data-testid="tab-pools">
            All Pools
          </TabsTrigger>
          <TabsTrigger value="my-positions" data-testid="tab-positions">
            My Positions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-6">
          {marinadeLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : marinadeInfo ? (
            <MarinadeStakingCard 
              marinadeInfo={marinadeInfo} 
              onStake={() => setStakeDialogOpen(true)} 
            />
          ) : null}

          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              DeFi Protocols
            </h3>
            {protocolsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {protocols?.filter(p => p.id !== "marinade").map((protocol) => (
                  <ProtocolCard 
                    key={protocol.id} 
                    protocol={protocol}
                    onClick={() => window.open(protocol.website, "_blank")}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pools" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Available Pools</h3>
            <Badge variant="outline">
              {pools?.length || 0} pools
            </Badge>
          </div>
          
          {poolsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pools?.map((pool) => (
                <PoolCard key={pool.id} pool={pool} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-positions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Your Positions</h3>
            <Badge variant="outline">
              {strategies?.length || 0} active
            </Badge>
          </div>

          {marinadeInfo && marinadeInfo.msolBalance > 0 && (
            <Card className="bg-gradient-to-br from-primary/5 to-cyan-500/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-white font-bold">
                      M
                    </div>
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        Marinade Staking
                        <Shield className="w-4 h-4 text-privacy" />
                      </h4>
                      <p className="text-sm text-muted-foreground">mSOL liquid staking</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg">
                      {formatNumber(marinadeInfo.msolBalance)} mSOL
                    </p>
                    <p className="text-sm text-success">
                      +{marinadeInfo.stats?.stakingApy?.toFixed(1) || "6.5"}% APY
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {strategiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : strategies && strategies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategies.map((strategy) => (
                <StrategyCard key={strategy.id} strategy={strategy} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Positions</h3>
                <p className="text-muted-foreground mb-4">
                  Start earning yield by staking SOL with Marinade or providing liquidity
                </p>
                <Button onClick={() => setStakeDialogOpen(true)} data-testid="button-get-started">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Get Started
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <StakeDialog 
        open={stakeDialogOpen} 
        onClose={() => setStakeDialogOpen(false)}
        marinadeInfo={marinadeInfo}
      />
    </div>
  );
}
