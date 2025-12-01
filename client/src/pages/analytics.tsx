import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWalletContext } from "@/components/wallet-provider";
import { 
  TrendingUp, 
  TrendingDown, 
  Shield,
  Activity,
  PieChart,
  BarChart3,
  Calendar,
  Wallet,
  DollarSign,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
  Info
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import type { 
  PortfolioHolding, 
  PortfolioStats, 
  AnalyticsStats, 
  PnLDataPoint, 
  ActivityBreakdown,
  TradeRecord 
} from "@shared/schema";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

const CHART_COLORS = [
  "hsl(195, 100%, 35%)",
  "hsl(170, 100%, 40%)",
  "hsl(45, 100%, 50%)",
  "hsl(280, 70%, 60%)",
  "hsl(330, 80%, 55%)",
];

function PnLChart({ data, isLoading }: { data: PnLDataPoint[]; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Info className="w-8 h-8 mx-auto mb-2" />
          <p>No trading data yet</p>
          <p className="text-sm">Complete some swaps to see your P&L chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(195, 100%, 35%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(195, 100%, 35%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number, name: string) => [
              formatCurrency(value), 
              name === "pnl" ? "Cumulative P&L" : "Daily P&L"
            ]}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke="hsl(195, 100%, 35%)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPnL)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function VolumeChart({ data, isLoading }: { data: PnLDataPoint[]; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Info className="w-8 h-8 mx-auto mb-2" />
          <p>No volume data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [formatCurrency(value), "Volume"]}
          />
          <Bar dataKey="volume" fill="hsl(170, 100%, 40%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityBreakdownChart({ data, isLoading }: { data: ActivityBreakdown[]; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  const hasData = data && data.some(d => d.count > 0);
  
  if (!hasData) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Info className="w-8 h-8 mx-auto mb-2" />
          <p>No activity yet</p>
          <p className="text-sm">Start trading to see activity breakdown</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-[200px] w-full flex items-center gap-4">
      <ResponsiveContainer width="50%" height="100%">
        <RePieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </RePieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">({item.count})</span>
              <span className="text-sm font-mono">{item.value}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon,
  subtitle,
  isLoading 
}: { 
  title: string; 
  value: string; 
  change?: number;
  icon: any;
  subtitle?: string;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-xs ${change >= 0 ? "text-success" : "text-destructive"}`}>
                {change >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {formatPercent(change)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopPerformers({ holdings, isLoading }: { holdings: PortfolioHolding[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!holdings || holdings.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No holdings to analyze
      </div>
    );
  }

  const sorted = [...holdings].sort((a, b) => b.change24h - a.change24h);
  const topGainers = sorted.slice(0, 3);
  const topLosers = sorted.slice(-3).reverse();
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-success" />
          Top Gainers
        </h4>
        <div className="space-y-2">
          {topGainers.map((holding, index) => (
            <div key={holding.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md" data-testid={`gainer-${index}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{index + 1}</span>
                <span className="font-medium">{holding.tokenSymbol}</span>
              </div>
              <span className="text-success text-sm font-mono">+{holding.change24h.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-destructive" />
          Top Losers
        </h4>
        <div className="space-y-2">
          {topLosers.map((holding, index) => (
            <div key={holding.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md" data-testid={`loser-${index}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{index + 1}</span>
                <span className="font-medium">{holding.tokenSymbol}</span>
              </div>
              <span className="text-destructive text-sm font-mono">{holding.change24h.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecentTrades({ trades, isLoading }: { trades: TradeRecord[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Info className="w-8 h-8 mx-auto mb-2" />
        <p>No trades yet</p>
        <p className="text-sm">Complete your first swap to see trade history</p>
      </div>
    );
  }

  // Get best and worst trades
  const sortedByPnL = [...trades].sort((a, b) => b.pnl - a.pnl);
  const bestTrade = sortedByPnL[0];
  const worstTrade = sortedByPnL[sortedByPnL.length - 1];

  return (
    <div className="space-y-4">
      {bestTrade && bestTrade.pnl > 0 && (
        <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20" data-testid="best-trade">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-success" />
            <div>
              <p className="font-medium">Best Trade</p>
              <p className="text-xs text-muted-foreground">
                {bestTrade.fromToken} → {bestTrade.toToken} ({bestTrade.date})
              </p>
            </div>
          </div>
          <span className="text-success font-bold font-mono">
            +{formatCurrency(bestTrade.pnl)}
          </span>
        </div>
      )}
      {worstTrade && worstTrade.pnl < 0 && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20" data-testid="worst-trade">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-medium">Worst Trade</p>
              <p className="text-xs text-muted-foreground">
                {worstTrade.fromToken} → {worstTrade.toToken} ({worstTrade.date})
              </p>
            </div>
          </div>
          <span className="text-destructive font-bold font-mono">
            {formatCurrency(worstTrade.pnl)}
          </span>
        </div>
      )}
      {(!bestTrade || bestTrade.pnl <= 0) && (!worstTrade || worstTrade.pnl >= 0) && (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">Complete more trades to see best/worst performance</p>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { connected, publicKey } = useWalletContext();
  const [period, setPeriod] = useState("30d");

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  // Fetch real analytics stats
  const { data: analyticsStats, isLoading: statsLoading } = useQuery<AnalyticsStats>({
    queryKey: ["/api/analytics/stats", { wallet: publicKey, days }],
    enabled: connected && !!publicKey,
  });

  // Fetch real P&L data
  const { data: pnlData, isLoading: pnlLoading } = useQuery<PnLDataPoint[]>({
    queryKey: ["/api/analytics/pnl", { wallet: publicKey, days }],
    enabled: connected && !!publicKey,
  });

  // Fetch activity breakdown
  const { data: activityBreakdown, isLoading: breakdownLoading } = useQuery<ActivityBreakdown[]>({
    queryKey: ["/api/analytics/activity-breakdown", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  // Fetch trade history
  const { data: trades, isLoading: tradesLoading } = useQuery<TradeRecord[]>({
    queryKey: ["/api/analytics/trades", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const { data: portfolioStats, isLoading: portfolioStatsLoading } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const { data: holdings, isLoading: holdingsLoading } = useQuery<PortfolioHolding[]>({
    queryKey: ["/api/portfolio/holdings", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  if (!connected) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your portfolio performance and trading history
          </p>
        </div>
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-12 pb-12 text-center">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Connect Wallet</h3>
            <p className="text-muted-foreground">
              Connect your wallet to view detailed analytics and performance metrics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = statsLoading || pnlLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Real-time trading performance from your on-chain activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32" data-testid="select-period">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total P&L"
          value={analyticsStats ? formatCurrency(analyticsStats.totalPnL) : "$0.00"}
          change={analyticsStats?.pnlPercent}
          icon={DollarSign}
          subtitle="All-time profit/loss"
          isLoading={statsLoading}
        />
        <MetricCard
          title="Trading Volume"
          value={analyticsStats ? formatCurrency(analyticsStats.totalVolume) : "$0.00"}
          icon={BarChart3}
          subtitle={analyticsStats ? `${analyticsStats.totalTrades} total trades` : "0 total trades"}
          isLoading={statsLoading}
        />
        <MetricCard
          title="Win Rate"
          value={analyticsStats ? `${analyticsStats.winRate.toFixed(1)}%` : "0%"}
          icon={Percent}
          subtitle={analyticsStats ? `${analyticsStats.winningTrades} winning trades` : "0 winning trades"}
          isLoading={statsLoading}
        />
        <MetricCard
          title="Privacy Score"
          value={analyticsStats ? `${analyticsStats.privateRatio.toFixed(0)}%` : "100%"}
          icon={Shield}
          subtitle="Transactions via shadow balance"
          isLoading={statsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Performance
              </CardTitle>
              <CardDescription>Cumulative profit and loss over time</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Shield className="w-3 h-3" />
              Real Data
            </Badge>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pnl">
              <TabsList className="mb-4">
                <TabsTrigger value="pnl" data-testid="tab-pnl">P&L</TabsTrigger>
                <TabsTrigger value="volume" data-testid="tab-volume">Volume</TabsTrigger>
              </TabsList>
              <TabsContent value="pnl">
                <PnLChart data={pnlData || []} isLoading={pnlLoading} />
              </TabsContent>
              <TabsContent value="volume">
                <VolumeChart data={pnlData || []} isLoading={pnlLoading} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Activity Breakdown
            </CardTitle>
            <CardDescription>Distribution of transaction types</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityBreakdownChart data={activityBreakdown || []} isLoading={breakdownLoading} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Best & Worst Trades
            </CardTitle>
            <CardDescription>Your standout trades this period</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentTrades trades={trades || []} isLoading={tradesLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Token Performance
            </CardTitle>
            <CardDescription>24h gainers and losers in your portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <TopPerformers holdings={holdings || []} isLoading={holdingsLoading} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Activity Summary
          </CardTitle>
          <CardDescription>
            Quick overview of your trading activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center" data-testid="stat-total-trades">
              <p className="text-2xl font-bold">{analyticsStats?.totalTrades || 0}</p>
              <p className="text-xs text-muted-foreground">Total Trades</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center" data-testid="stat-avg-trade">
              <p className="text-2xl font-bold">{analyticsStats ? formatCurrency(analyticsStats.avgTradeSize) : "$0.00"}</p>
              <p className="text-xs text-muted-foreground">Avg Trade Size</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center" data-testid="stat-positions">
              <p className="text-2xl font-bold">{portfolioStats?.activePositions || 0}</p>
              <p className="text-xs text-muted-foreground">Active Positions</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center" data-testid="stat-pending">
              <p className="text-2xl font-bold">{portfolioStats?.pendingActions || 0}</p>
              <p className="text-xs text-muted-foreground">Pending Actions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
