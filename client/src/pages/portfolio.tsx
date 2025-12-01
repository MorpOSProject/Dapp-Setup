import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWalletContext } from "@/components/wallet-provider";
import { PrivacyShield, MaskedValue } from "@/components/privacy-shield";
import { MoveToShadowDialog } from "@/components/move-to-shadow-dialog";
import { 
  TrendingUp, 
  TrendingDown, 
  Shield,
  ArrowLeftRight,
  ArrowUpRight,
  ExternalLink,
  Wallet,
  PieChart,
  Layers,
  EyeOff,
  Eye
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { PortfolioHolding, DefiPosition, PortfolioStats } from "@shared/schema";
import { Link } from "wouter";
import { TokenLogo } from "@/components/token-logo";

function formatCurrency(value: number): string {
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


function PortfolioChart({ period, holdings }: { period: string; holdings: PortfolioHolding[] }) {
  const chartData = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const variance = (Math.random() - 0.5) * totalValue * 0.02;
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: Math.max(0, totalValue + variance * (i / 30)),
      };
    });
  }, [holdings]);

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">No portfolio data to display</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
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
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [formatCurrency(value), "Value"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(195, 100%, 35%)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HoldingsTable() {
  const { connected, publicKey } = useWalletContext();
  
  const { data: holdings, isLoading } = useQuery<PortfolioHolding[]>({
    queryKey: ["/api/portfolio/holdings", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const displayHoldings = holdings ?? [];

  if (!connected) {
    return (
      <div className="text-center py-12">
        <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Connect wallet to view holdings</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead className="text-right">Shadow Balance</TableHead>
          <TableHead className="text-right">Public Balance</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="text-right">24h</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {displayHoldings.map((holding) => (
          <TableRow key={holding.id} data-testid={`holding-row-${holding.tokenSymbol}`}>
            <TableCell>
              <div className="flex items-center gap-3">
                <TokenLogo symbol={holding.tokenSymbol} size="md" />
                <div>
                  <div className="font-medium flex items-center gap-1">
                    {holding.tokenSymbol}
                    <Shield className="w-3 h-3 text-privacy" />
                  </div>
                  <div className="text-xs text-muted-foreground">{holding.tokenName}</div>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right font-mono">
              <MaskedValue 
                value={formatNumber(holding.shadowBalance)} 
                defaultMasked={false}
              />
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {formatNumber(holding.publicBalance)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(holding.valueUsd)}
            </TableCell>
            <TableCell className="text-right">
              <div className={`flex items-center justify-end gap-1 ${holding.change24h >= 0 ? "text-success" : "text-destructive"}`}>
                {holding.change24h >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(holding.change24h).toFixed(1)}%
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {holding.publicBalance > 0 && (
                  <MoveToShadowDialog
                    holding={holding}
                    walletAddress={publicKey || ""}
                    mode="to-shadow"
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Shield tokens" data-testid={`button-shield-${holding.tokenSymbol}`}>
                        <EyeOff className="w-4 h-4" />
                      </Button>
                    }
                  />
                )}
                {holding.shadowBalance > 0 && (
                  <MoveToShadowDialog
                    holding={holding}
                    walletAddress={publicKey || ""}
                    mode="from-shadow"
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Unshield tokens" data-testid={`button-unshield-${holding.tokenSymbol}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    }
                  />
                )}
                <Link href="/swap">
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-swap-${holding.tokenSymbol}`}>
                    <ArrowLeftRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-send-${holding.tokenSymbol}`}>
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeFiPositionsGrid() {
  const { connected, publicKey } = useWalletContext();
  
  const { data: positions, isLoading } = useQuery<DefiPosition[]>({
    queryKey: ["/api/portfolio/positions", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const displayPositions = positions ?? [];

  if (!connected) {
    return (
      <div className="text-center py-12">
        <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Connect wallet to view positions</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getPositionTypeLabel = (type: string) => {
    switch (type) {
      case "staking": return "Staking";
      case "liquidity": return "Liquidity";
      case "lending": return "Lending";
      case "farming": return "Farming";
      default: return type;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayPositions.map((position) => (
        <Card key={position.id} className="hover-elevate" data-testid={`position-card-${position.id}`}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                  {position.protocol.slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium flex items-center gap-1">
                    {position.protocol}
                    {position.isPrivate && <Shield className="w-3 h-3 text-privacy" />}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {getPositionTypeLabel(position.type)}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-success">
                  {position.apy.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">APY</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Deposited</div>
                <div className="font-medium">
                  {formatNumber(position.depositedAmount)} {position.depositedToken}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Current Value</div>
                <div className="font-medium">{formatCurrency(position.currentValue)}</div>
              </div>
            </div>

            {position.rewards > 0 && (
              <div className="flex items-center justify-between p-2 bg-success/10 rounded-md">
                <span className="text-sm text-muted-foreground">Claimable</span>
                <span className="font-medium text-success">
                  {formatNumber(position.rewards)} {position.rewardsToken}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                Manage
              </Button>
              {position.rewards > 0 && (
                <Button size="sm" className="flex-1">
                  Claim
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PortfolioPage() {
  const { connected, solBalance, publicKey } = useWalletContext();
  const [chartPeriod, setChartPeriod] = useState("30D");
  
  const { data: stats } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const { data: holdings } = useQuery<PortfolioHolding[]>({
    queryKey: ["/api/portfolio/holdings", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const totalValue = stats?.totalValue ?? 0;
  const change24h = stats?.change24hPercent ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">
            Manage your private holdings and DeFi positions
          </p>
        </div>
        {connected && (
          <div className="text-right">
            <div className="text-2xl font-bold" data-testid="text-total-portfolio-value">
              {formatCurrency(totalValue)}
            </div>
            <div className={`flex items-center justify-end gap-1 ${change24h >= 0 ? "text-success" : "text-destructive"}`}>
              {change24h >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}% (24h)
            </div>
          </div>
        )}
      </div>

      {connected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Portfolio Value</CardTitle>
              <CardDescription>Your total holdings over time</CardDescription>
            </div>
            <div className="flex gap-1">
              {["24H", "7D", "30D", "ALL"].map((period) => (
                <Button
                  key={period}
                  variant={chartPeriod === period ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartPeriod(period)}
                  data-testid={`button-period-${period}`}
                >
                  {period}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <PortfolioChart period={chartPeriod} holdings={holdings || []} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holdings" data-testid="tab-holdings">
            <PieChart className="w-4 h-4 mr-2" />
            Holdings
          </TabsTrigger>
          <TabsTrigger value="defi" data-testid="tab-defi">
            <Layers className="w-4 h-4 mr-2" />
            DeFi Positions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <CardTitle>Token Holdings</CardTitle>
              <CardDescription>
                Your shadow and public token balances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HoldingsTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defi">
          <Card>
            <CardHeader>
              <CardTitle>DeFi Positions</CardTitle>
              <CardDescription>
                Your active staking, lending, and liquidity positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeFiPositionsGrid />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
