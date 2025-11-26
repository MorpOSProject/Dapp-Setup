import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletContext } from "@/components/wallet-provider";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { PrivacyShield, PrivacyScore, MaskedValue } from "@/components/privacy-shield";
import { 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Clock, 
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Shield,
  Wallet,
  ExternalLink,
  Loader2,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { PortfolioStats, Activity, BatchedAction, PortfolioHolding } from "@shared/schema";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ShadowBalanceCard() {
  const { connected, publicKey } = useWalletContext();
  
  const { data: holdings, isLoading } = useQuery<PortfolioHolding[]>({
    queryKey: ["/api/portfolio/holdings", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  if (!connected) {
    return (
      <Card className="col-span-full lg:col-span-2 bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            Connect your Solana wallet to access your shadow balances and private DeFi features
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }

  // Calculate total USD value from holdings
  const totalValue = (holdings || []).reduce((sum, h) => sum + h.valueUsd, 0);
  // Until user moves assets to shadow balance, everything is public
  const totalPublicValue = totalValue;
  const totalShadowValue = 0;

  return (
    <Card className="col-span-full lg:col-span-2 bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div>
          <CardDescription className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-privacy" />
            Total Portfolio Value
          </CardDescription>
          <CardTitle className="text-3xl font-bold mt-1" data-testid="text-shadow-balance">
            <MaskedValue value={formatCurrency(totalValue)} defaultMasked={false} />
          </CardTitle>
        </div>
        <PrivacyShield level="high" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Public Balance:</span>
            <span className="font-medium">{formatCurrency(totalPublicValue)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shadow Balance:</span>
            <span className="font-medium text-privacy">{formatCurrency(totalShadowValue)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Shadow balance is the amount of your assets that can be kept private through MORP OS batching. Public balance is visible on-chain.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStatsGrid() {
  const { connected, solBalance, publicKey } = useWalletContext();
  
  const { data: stats, isLoading } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const statItems = [
    {
      label: "Total Value",
      value: formatCurrency(stats?.totalValue ?? 0),
      icon: Wallet,
      change: stats?.change24hPercent ? `${stats.change24hPercent >= 0 ? '+' : ''}${stats.change24hPercent.toFixed(2)}%` : undefined,
      positive: (stats?.change24hPercent ?? 0) >= 0,
    },
    {
      label: "Active Positions",
      value: (stats?.activePositions ?? 0).toString(),
      icon: Layers,
      sublabel: "DeFi protocols",
    },
    {
      label: "Pending Actions",
      value: (stats?.pendingActions ?? 0).toString(),
      icon: Clock,
      sublabel: "In batch queue",
      highlight: (stats?.pendingActions ?? 0) > 0,
    },
  ];

  if (!connected) {
    return null;
  }

  return (
    <>
      {statItems.map((item) => (
        <Card key={item.label} className={item.highlight ? "border-warning/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardDescription>{item.label}</CardDescription>
            <item.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid={`text-stat-${item.label.toLowerCase().replace(" ", "-")}`}>
                  {item.value}
                </div>
                {item.change && (
                  <p className={`text-xs ${item.positive ? "text-success" : "text-destructive"}`}>
                    {item.change} from yesterday
                  </p>
                )}
                {item.sublabel && (
                  <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function PrivacyScoreCard() {
  const { connected, publicKey } = useWalletContext();
  
  const { data: stats } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  if (!connected) return null;

  const score = stats?.privacyScore ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Your Privacy</CardDescription>
      </CardHeader>
      <CardContent>
        <PrivacyScore score={score} />
      </CardContent>
    </Card>
  );
}

function RecentActivityList() {
  const { connected, publicKey } = useWalletContext();
  
  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activity", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "swap":
        return ArrowLeftRight;
      case "transfer":
        return ArrowUpRight;
      case "deposit":
        return ArrowDownRight;
      case "withdraw":
        return ArrowUpRight;
      default:
        return Layers;
    }
  };

  if (!connected) {
    return (
      <Card className="col-span-full lg:col-span-3">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Connect wallet to view activity</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const displayActivities = activities || [];

  if (displayActivities.length === 0) {
    return (
      <Card className="col-span-full lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest private transactions</CardDescription>
          </div>
          <Link href="/portfolio">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-activity">
              View all
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest private transactions</CardDescription>
        </div>
        <Link href="/portfolio">
          <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-activity">
            View all
            <ExternalLink className="w-3 h-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {displayActivities.slice(0, 5).map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const timestamp = typeof activity.timestamp === 'number' ? activity.timestamp : new Date(activity.timestamp).getTime();
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-2 rounded-md hover-elevate"
                  data-testid={`activity-item-${activity.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{activity.description}</span>
                      {activity.isPrivate && (
                        <Shield className="w-3 h-3 text-privacy flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatTimeAgo(timestamp)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(activity.valueUsd)}</div>
                    <Badge
                      variant={activity.status === "completed" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {activity.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type BatchExecutionStatus = "idle" | "executing" | "success" | "error";

function BatchQueueCard() {
  const { connected, publicKey, refreshBalance } = useWalletContext();
  const { signTransaction } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  const [executionStatus, setExecutionStatus] = useState<BatchExecutionStatus>("idle");
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [actionStatuses, setActionStatuses] = useState<Record<string, "pending" | "executing" | "success" | "error">>({});
  
  const { data: actions, refetch: refetchActions } = useQuery<BatchedAction[]>({
    queryKey: ["/api/batched-actions", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const executeSwapAction = useCallback(async (action: BatchedAction): Promise<boolean> => {
    if (!publicKey || !signTransaction || action.actionType !== "swap") {
      return false;
    }

    const metadata = action.metadata as { fromToken?: string; toToken?: string; fromAmount?: number; slippage?: number } | undefined;
    if (!metadata?.fromToken || !metadata?.toToken || !metadata?.fromAmount) {
      console.error("Invalid swap action metadata:", metadata);
      return false;
    }

    try {
      const quoteRes = await fetch(`/api/swap/quote?inputMint=${metadata.fromToken}&outputMint=${metadata.toToken}&amount=${metadata.fromAmount}&slippage=${metadata.slippage || 0.5}`);
      if (!quoteRes.ok) throw new Error("Failed to get quote");
      const quote = await quoteRes.json();

      const txRes = await apiRequest("POST", "/api/swap/transaction", {
        quoteResponse: quote,
        userPublicKey: publicKey,
      });
      const txResponse = await txRes.json();

      if (!txResponse.swapTransaction) {
        throw new Error("Failed to get swap transaction");
      }

      const swapTransactionBuf = Buffer.from(txResponse.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      const transactionBlockhash = transaction.message.recentBlockhash;
      
      const signedTransaction = await signTransaction(transaction);
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: transactionBlockhash,
          lastValidBlockHeight: txResponse.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      await apiRequest("PATCH", `/api/batched-actions/${action.id}`, {
        status: "completed",
        txSignature: signature,
      });

      return true;
    } catch (error) {
      console.error("Swap action failed:", error);
      await apiRequest("PATCH", `/api/batched-actions/${action.id}`, {
        status: "failed",
      });
      return false;
    }
  }, [publicKey, signTransaction, connection]);

  const executeBatch = useCallback(async () => {
    const queuedActions = actions?.filter((a) => a.status === "queued") ?? [];
    if (queuedActions.length === 0) return;

    setExecutionStatus("executing");
    setCurrentActionIndex(0);
    setActionStatuses({});

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < queuedActions.length; i++) {
      const action = queuedActions[i];
      setCurrentActionIndex(i);
      setActionStatuses(prev => ({ ...prev, [action.id]: "executing" }));

      try {
        if (action.actionType === "swap") {
          const success = await executeSwapAction(action);
          if (success) {
            setActionStatuses(prev => ({ ...prev, [action.id]: "success" }));
            successCount++;
          } else {
            setActionStatuses(prev => ({ ...prev, [action.id]: "error" }));
            failCount++;
          }
        } else {
          await apiRequest("PATCH", `/api/batched-actions/${action.id}`, {
            status: "completed",
          });
          setActionStatuses(prev => ({ ...prev, [action.id]: "success" }));
          successCount++;
        }
      } catch (error) {
        console.error("Action execution failed:", error);
        setActionStatuses(prev => ({ ...prev, [action.id]: "error" }));
        failCount++;
      }
    }

    setExecutionStatus(failCount === 0 ? "success" : "error");
    
    toast({
      title: failCount === 0 ? "Batch executed successfully" : "Batch executed with errors",
      description: `${successCount} actions completed${failCount > 0 ? `, ${failCount} failed` : ""}`,
      variant: failCount > 0 ? "destructive" : "default",
    });

    refreshBalance();
    refetchActions();
    queryClient.invalidateQueries({ queryKey: ["/api/activity", { wallet: publicKey }] });
    queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings", { wallet: publicKey }] });
    queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats", { wallet: publicKey }] });

    setTimeout(() => {
      setExecutionStatus("idle");
      setActionStatuses({});
    }, 3000);
  }, [actions, executeSwapAction, refreshBalance, refetchActions, publicKey, toast]);

  if (!connected) return null;

  const queuedActions = actions?.filter((a) => a.status === "queued") ?? [];
  const batchProgress = Math.min((queuedActions.length / 5) * 100, 100);

  const getActionStatusIcon = (actionId: string) => {
    const status = actionStatuses[actionId];
    if (status === "executing") return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    if (status === "success") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "error") return <XCircle className="w-4 h-4 text-destructive" />;
    return null;
  };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Batch Queue</CardTitle>
          <CardDescription>Actions pending for privacy batching</CardDescription>
        </div>
        <Badge variant="outline" className="text-xs">
          {queuedActions.length}/5 actions
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Batch progress</span>
            <span className="font-medium">{batchProgress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${batchProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Actions are batched together for maximum privacy
          </p>
        </div>

        {queuedActions.length === 0 ? (
          <div className="text-center py-4">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No pending actions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queuedActions.slice(0, 3).map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
              >
                <span className="text-sm">{action.description}</span>
                <div className="flex items-center gap-2">
                  {getActionStatusIcon(action.id)}
                  <Badge variant="secondary" className="text-xs">
                    {actionStatuses[action.id] || "Queued"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button 
          variant="outline" 
          className="w-full" 
          disabled={queuedActions.length === 0 || executionStatus === "executing"}
          onClick={executeBatch}
          data-testid="button-execute-batch"
        >
          {executionStatus === "executing" ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Executing ({currentActionIndex + 1}/{queuedActions.length})
            </>
          ) : (
            "Execute Batch Now"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Your private finance overview
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <ShadowBalanceCard />
        <QuickStatsGrid />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <RecentActivityList />
        <BatchQueueCard />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PrivacyScoreCard />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common private finance operations</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link href="/swap">
              <Button variant="outline" className="w-full gap-2" data-testid="button-quick-swap">
                <ArrowLeftRight className="w-4 h-4" />
                Private Swap
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button variant="outline" className="w-full gap-2" data-testid="button-quick-portfolio">
                <Layers className="w-4 h-4" />
                View Portfolio
              </Button>
            </Link>
            <Link href="/disclosure">
              <Button variant="outline" className="w-full gap-2" data-testid="button-quick-disclosure">
                <Shield className="w-4 h-4" />
                Generate Proof
              </Button>
            </Link>
            <Button variant="outline" className="w-full gap-2" disabled>
              <Clock className="w-4 h-4" />
              Batch Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
