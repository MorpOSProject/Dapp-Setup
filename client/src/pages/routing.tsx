import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useWalletContext } from "@/components/wallet-provider";
import { useToast } from "@/hooks/use-toast";
import {
  Route,
  Shield,
  Clock,
  Shuffle,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  BarChart3,
  TrendingUp,
  Activity,
  Timer,
  Wallet,
  ArrowRight,
  Hash,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Lock,
  Sparkles,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface RoutingProfile {
  id: string;
  walletAddress: string;
  enableRouteObfuscation: boolean;
  enableDecoyTransactions: boolean;
  enableTimingRandomization: boolean;
  enableTransactionSplitting: boolean;
  decoyDensity: number;
  minDelayMs: number;
  maxDelayMs: number;
  splitThreshold: number;
  maxSplitParts: number;
  privacyLevel: string;
}

interface RoutingBatch {
  batchId: string;
  status: string;
  privacyScore: number;
  totalSegments: number;
  completedSegments: number;
  inputToken?: string;
  outputToken?: string;
  totalAmount?: number;
  createdAt: string;
  completedAt?: string;
}

interface RoutePlanResponse {
  batchId: string;
  privacyScore: number;
  totalSegments: number;
  realSegments: number;
  decoySegments: number;
  splitSegments: number;
  estimatedDurationMs: number;
  timingWindow: {
    start: string;
    end: string;
  };
  segments: Array<{
    index: number;
    type: "real" | "decoy" | "split";
    tokenSymbol?: string;
    amountMasked: boolean;
    scheduledDelay: number;
    dexProtocol?: string;
    commitment: string;
  }>;
  obfuscationDetails: {
    decoyDensity: number;
    timingEntropyLevel: string;
    routeDiversityScore: number;
  };
}

interface PrivacyMetrics {
  averagePrivacyScore: number;
  totalRoutedTransactions: number;
  totalDecoysGenerated: number;
  averageTimingEntropy: number;
  routeDiversityScore: number;
  bestPrivacyScore: number;
  weeklyStats: Array<{
    week: string;
    transactions: number;
    avgPrivacyScore: number;
  }>;
}

interface ZkConfig {
  id: string;
  walletAddress: string;
  zkMode: "simulator" | "zk_enabled";
  proofVerificationLevel: string;
  autoRefreshInterval: number;
  maxGasLamports: number;
  cachedStateRoot?: string;
  lastStateSyncAt?: string;
}

interface ZkCapabilities {
  supportsCompressedTokens: boolean;
  supportsProofGeneration: boolean;
  supportsDecoyTransactions: boolean;
  maxDecoyCount: number;
  supportedTokens: string[];
  network: string;
  isRealZkAvailable: boolean;
  rpcEndpoint: string | null;
}

interface ZkSession {
  id: string;
  batchId: string;
  proofStatus: string;
  createdAt: string;
}

const TOKEN_LIST = [
  { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana" },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin" },
  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether" },
  { mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", symbol: "mSOL", name: "Marinade SOL" },
  { mint: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", symbol: "stSOL", name: "Lido Staked SOL" },
];

function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "planning":
      return <Badge variant="secondary" className="gap-1"><Settings className="h-3 w-3" /> Planning</Badge>;
    case "scheduled":
      return <Badge className="gap-1 bg-blue-500/20 text-blue-500 hover:bg-blue-500/30"><Clock className="h-3 w-3" /> Scheduled</Badge>;
    case "executing":
      return <Badge className="gap-1 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30"><Loader2 className="h-3 w-3 animate-spin" /> Executing</Badge>;
    case "completed":
      return <Badge className="gap-1 bg-green-500/20 text-green-500 hover:bg-green-500/30"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
    case "failed":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="gap-1"><Pause className="h-3 w-3" /> Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSegmentTypeBadge(type: string) {
  switch (type) {
    case "real":
      return <Badge className="gap-1 bg-green-500/20 text-green-500"><Zap className="h-3 w-3" /> Real</Badge>;
    case "decoy":
      return <Badge className="gap-1 bg-purple-500/20 text-purple-500"><Shuffle className="h-3 w-3" /> Decoy</Badge>;
    case "split":
      return <Badge className="gap-1 bg-blue-500/20 text-blue-500"><Layers className="h-3 w-3" /> Split</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function getPrivacyLevelBadge(score: number) {
  if (score >= 80) {
    return <Badge className="gap-1 bg-green-500/20 text-green-500"><Shield className="h-3 w-3" /> Maximum</Badge>;
  } else if (score >= 60) {
    return <Badge className="gap-1 bg-blue-500/20 text-blue-500"><Shield className="h-3 w-3" /> Enhanced</Badge>;
  } else if (score >= 40) {
    return <Badge className="gap-1 bg-yellow-500/20 text-yellow-500"><Shield className="h-3 w-3" /> Standard</Badge>;
  } else {
    return <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" /> Basic</Badge>;
  }
}

function PrivacySettingsCard() {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<RoutingProfile>({
    queryKey: ["/api/private-routing/profile", publicKey],
    queryFn: async () => {
      const res = await fetch(`/api/private-routing/profile?wallet=${publicKey}`);
      if (!res.ok) {
        throw new Error("Failed to fetch routing profile");
      }
      return res.json();
    },
    enabled: !!publicKey && connected,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<RoutingProfile>) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const res = await apiRequest("PATCH", "/api/private-routing/profile", {
        walletAddress: publicKey,
        ...updates,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings Updated", description: "Privacy routing settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/private-routing/profile", publicKey] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Privacy Settings
          </CardTitle>
          <CardDescription>Configure your private routing preferences</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Connect your wallet to configure settings</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Privacy Settings
        </CardTitle>
        <CardDescription>Configure route obfuscation and timing settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Route className="h-4 w-4 text-muted-foreground" />
              Route Obfuscation
            </Label>
            <p className="text-xs text-muted-foreground">Hide DEX routing paths from analysis</p>
          </div>
          <Switch
            data-testid="switch-route-obfuscation"
            checked={profile?.enableRouteObfuscation ?? true}
            onCheckedChange={(checked) => updateMutation.mutate({ enableRouteObfuscation: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-muted-foreground" />
              Decoy Transactions
            </Label>
            <p className="text-xs text-muted-foreground">Add noise transactions to confuse observers</p>
          </div>
          <Switch
            data-testid="switch-decoy-transactions"
            checked={profile?.enableDecoyTransactions ?? true}
            onCheckedChange={(checked) => updateMutation.mutate({ enableDecoyTransactions: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              Timing Randomization
            </Label>
            <p className="text-xs text-muted-foreground">Add random delays to break timing patterns</p>
          </div>
          <Switch
            data-testid="switch-timing-randomization"
            checked={profile?.enableTimingRandomization ?? true}
            onCheckedChange={(checked) => updateMutation.mutate({ enableTimingRandomization: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Transaction Splitting
            </Label>
            <p className="text-xs text-muted-foreground">Split large transactions into smaller parts</p>
          </div>
          <Switch
            data-testid="switch-transaction-splitting"
            checked={profile?.enableTransactionSplitting ?? false}
            onCheckedChange={(checked) => updateMutation.mutate({ enableTransactionSplitting: checked })}
          />
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Decoy Density</Label>
              <span className="text-sm font-medium">{profile?.decoyDensity ?? 2} decoys</span>
            </div>
            <Slider
              data-testid="slider-decoy-density"
              value={[profile?.decoyDensity ?? 2]}
              onValueChange={([value]) => updateMutation.mutate({ decoyDensity: value })}
              max={5}
              min={0}
              step={1}
            />
            <p className="text-xs text-muted-foreground">Number of decoy transactions per route</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Max Delay</Label>
              <span className="text-sm font-medium">{((profile?.maxDelayMs ?? 5000) / 1000).toFixed(1)}s</span>
            </div>
            <Slider
              data-testid="slider-max-delay"
              value={[profile?.maxDelayMs ?? 5000]}
              onValueChange={([value]) => updateMutation.mutate({ maxDelayMs: value })}
              max={30000}
              min={1000}
              step={1000}
            />
            <p className="text-xs text-muted-foreground">Maximum random delay between segments</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="space-y-0.5">
            <Label>Privacy Level</Label>
            <p className="text-xs text-muted-foreground">Current configuration level</p>
          </div>
          {getPrivacyLevelBadge(
            ((profile?.enableRouteObfuscation ? 25 : 0) +
             (profile?.enableDecoyTransactions ? 25 : 0) +
             (profile?.enableTimingRandomization ? 25 : 0) +
             (profile?.enableTransactionSplitting ? 15 : 0) +
             Math.min(10, (profile?.decoyDensity ?? 0) * 2))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ZkModeConfigCard() {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: zkConfig, isLoading: configLoading } = useQuery<ZkConfig>({
    queryKey: ["/api/zk/config", publicKey],
    queryFn: async () => {
      const res = await fetch(`/api/zk/config?wallet=${publicKey}`);
      if (!res.ok) throw new Error("Failed to fetch ZK config");
      return res.json();
    },
    enabled: !!publicKey && connected,
  });

  const { data: capabilities } = useQuery<ZkCapabilities>({
    queryKey: ["/api/zk/capabilities"],
    queryFn: async () => {
      const res = await fetch("/api/zk/capabilities");
      if (!res.ok) throw new Error("Failed to fetch ZK capabilities");
      return res.json();
    },
    enabled: connected,
  });

  const { data: sessions } = useQuery<ZkSession[]>({
    queryKey: ["/api/zk/sessions", publicKey],
    queryFn: async () => {
      const res = await fetch(`/api/zk/sessions?wallet=${publicKey}`);
      if (!res.ok) throw new Error("Failed to fetch ZK sessions");
      return res.json();
    },
    enabled: !!publicKey && connected,
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<ZkConfig>) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const res = await apiRequest("PATCH", "/api/zk/config", {
        walletAddress: publicKey,
        ...updates,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update ZK config");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "ZK Configuration Updated", description: "Zero-knowledge privacy settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/zk/config", publicKey] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const syncStateMutation = useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error("Wallet not connected");
      const res = await apiRequest("POST", "/api/zk/sync-state", {
        walletAddress: publicKey,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to sync state tree");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "State Tree Synced", 
        description: `Root: ${data.stateRoot?.slice(0, 16)}...` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/zk/config", publicKey] });
    },
    onError: (error: any) => {
      toast({ title: "Sync Error", description: error.message, variant: "destructive" });
    },
  });

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Zero-Knowledge Mode
          </CardTitle>
          <CardDescription>Configure Light Protocol ZK privacy</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Connect your wallet to configure ZK mode</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (configLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isZkEnabled = zkConfig?.zkMode === "zk_enabled";
  const lastSync = zkConfig?.lastStateSyncAt 
    ? formatDate(zkConfig.lastStateSyncAt)
    : "Never synced";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Zero-Knowledge Mode
        </CardTitle>
        <CardDescription>Real ZK privacy using Light Protocol compressed tokens</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Enable ZK Execution
            </Label>
            <p className="text-xs text-muted-foreground">
              Use real zero-knowledge proofs for on-chain privacy
            </p>
          </div>
          <Switch
            data-testid="switch-zk-mode"
            checked={isZkEnabled}
            onCheckedChange={(checked) => 
              updateConfigMutation.mutate({ 
                zkMode: checked ? "zk_enabled" : "simulator" 
              })
            }
            disabled={updateConfigMutation.isPending}
          />
        </div>

        <div className="p-3 rounded-lg bg-muted/30 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Mode</span>
            {isZkEnabled ? (
              <Badge className="gap-1 bg-purple-500/20 text-purple-500">
                <Lock className="h-3 w-3" /> ZK Enabled
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Settings className="h-3 w-3" /> Simulator
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last State Sync</span>
            <span className="font-mono text-xs">{lastSync}</span>
          </div>
          {zkConfig?.cachedStateRoot && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">State Root</span>
              <span className="font-mono text-xs">{zkConfig.cachedStateRoot.slice(0, 12)}...</span>
            </div>
          )}
        </div>

        {capabilities && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">ZK Capabilities</Label>
              <Badge variant={capabilities.isRealZkAvailable ? "default" : "outline"} className="text-xs">
                {capabilities.network}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`flex items-center gap-2 p-2 rounded-lg ${capabilities.isRealZkAvailable ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-muted/30'}`}>
                {capabilities.isRealZkAvailable ? (
                  <CheckCircle className="h-4 w-4 text-purple-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs">Real ZK Mode</span>
              </div>
              <div className={`flex items-center gap-2 p-2 rounded-lg bg-green-500/10`}>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs">Simulator Mode</span>
              </div>
              <div className={`flex items-center gap-2 p-2 rounded-lg ${capabilities.supportsProofGeneration ? 'bg-green-500/10' : 'bg-muted/30'}`}>
                {capabilities.supportsProofGeneration ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs">Proof Generation</span>
              </div>
              <div className={`flex items-center gap-2 p-2 rounded-lg ${capabilities.supportsCompressedTokens ? 'bg-green-500/10' : 'bg-muted/30'}`}>
                {capabilities.supportsCompressedTokens ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs">Compressed Tokens</span>
              </div>
            </div>
            {capabilities.isRealZkAvailable && capabilities.rpcEndpoint && (
              <div className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  <span className="text-xs text-purple-500">Connected to Light Protocol RPC</span>
                </div>
              </div>
            )}
            {!capabilities.isRealZkAvailable && (
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Real ZK mode requires a Helius API key with Light Protocol support. Using simulation mode.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button
            data-testid="button-sync-state"
            variant="outline"
            size="sm"
            onClick={() => syncStateMutation.mutate()}
            disabled={syncStateMutation.isPending}
            className="flex-1"
          >
            {syncStateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Sync State Tree
          </Button>
        </div>

        {sessions && sessions.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent ZK Sessions
            </Label>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {sessions.slice(0, 3).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-xs">
                  <span className="font-mono">{session.batchId?.slice(0, 8)}...</span>
                  <Badge variant="outline">
                    {session.proofStatus}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoutePlannerCard() {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [inputToken, setInputToken] = useState("SOL");
  const [outputToken, setOutputToken] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [enableDecoys, setEnableDecoys] = useState(true);
  const [enableTimingJitter, setEnableTimingJitter] = useState(true);
  const [enableSplitting, setEnableSplitting] = useState(false);
  const [customDecoyCount, setCustomDecoyCount] = useState(2);
  const [routePlan, setRoutePlan] = useState<RoutePlanResponse | null>(null);

  const planMutation = useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error("Wallet not connected");
      const inputMint = TOKEN_LIST.find(t => t.symbol === inputToken)?.mint || inputToken;
      const outputMint = TOKEN_LIST.find(t => t.symbol === outputToken)?.mint || outputToken;
      
      const res = await apiRequest("POST", "/api/private-routing/plan", {
        walletAddress: publicKey,
        inputToken: inputMint,
        outputToken: outputMint,
        amount: parseFloat(amount),
        slippageBps: 50,
        enableDecoys,
        enableTimingJitter,
        enableSplitting,
        customDecoyCount,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create route plan");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setRoutePlan(data);
      toast({ title: "Route Planned", description: `Privacy score: ${data.privacyScore}` });
      queryClient.invalidateQueries({ queryKey: ["/api/private-routing/history", publicKey] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!routePlan) throw new Error("No route plan");
      const res = await apiRequest("POST", "/api/private-routing/execute", {
        batchId: routePlan.batchId,
        walletAddress: publicKey,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to execute route");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: data.success ? "Route Executed" : "Execution Failed",
        description: `${data.completedSegments}/${data.totalSegments} segments completed`,
        variant: data.success ? "default" : "destructive",
      });
      setRoutePlan(null);
      queryClient.invalidateQueries({ queryKey: ["/api/private-routing/history", publicKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/private-routing/metrics", publicKey] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Private Route Planner
          </CardTitle>
          <CardDescription>Plan and execute privacy-enhanced transactions</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Connect your wallet to plan routes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Private Route Planner
        </CardTitle>
        <CardDescription>Plan swap routes with privacy features</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Token</Label>
            <Select value={inputToken} onValueChange={setInputToken}>
              <SelectTrigger data-testid="select-input-token">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOKEN_LIST.map((token) => (
                  <SelectItem key={token.mint} value={token.symbol}>
                    {token.symbol} - {token.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To Token</Label>
            <Select value={outputToken} onValueChange={setOutputToken}>
              <SelectTrigger data-testid="select-output-token">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOKEN_LIST.filter(t => t.symbol !== inputToken).map((token) => (
                  <SelectItem key={token.mint} value={token.symbol}>
                    {token.symbol} - {token.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            data-testid="input-amount"
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="privacy-options">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Privacy Options
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Enable Decoys</Label>
                <Switch
                  data-testid="switch-plan-decoys"
                  checked={enableDecoys}
                  onCheckedChange={setEnableDecoys}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Timing Randomization</Label>
                <Switch
                  data-testid="switch-plan-timing"
                  checked={enableTimingJitter}
                  onCheckedChange={setEnableTimingJitter}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Split Large Transactions</Label>
                <Switch
                  data-testid="switch-plan-splitting"
                  checked={enableSplitting}
                  onCheckedChange={setEnableSplitting}
                />
              </div>
              {enableDecoys && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Decoy Count</Label>
                    <span className="text-sm font-medium">{customDecoyCount}</span>
                  </div>
                  <Slider
                    data-testid="slider-plan-decoy-count"
                    value={[customDecoyCount]}
                    onValueChange={([value]) => setCustomDecoyCount(value)}
                    max={5}
                    min={1}
                    step={1}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {routePlan && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-medium">Privacy Score</span>
                </div>
                <div className="text-2xl font-bold">{routePlan.privacyScore}/100</div>
              </div>
              {getPrivacyLevelBadge(routePlan.privacyScore)}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-muted-foreground">Real</div>
                <div className="font-medium text-green-500">{routePlan.realSegments}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Decoy</div>
                <div className="font-medium text-purple-500">{routePlan.decoySegments}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div className="font-medium">{formatDuration(routePlan.estimatedDurationMs)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Route Segments</Label>
              <div className="max-h-32 overflow-auto space-y-1">
                {routePlan.segments.map((segment) => (
                  <div
                    key={segment.index}
                    className="flex items-center justify-between text-xs p-2 bg-background rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">#{segment.index + 1}</span>
                      {getSegmentTypeBadge(segment.type)}
                    </div>
                    <div className="flex items-center gap-2">
                      {segment.amountMasked ? (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <EyeOff className="h-3 w-3" /> Hidden
                        </span>
                      ) : (
                        <span>{segment.tokenSymbol}</span>
                      )}
                      <span className="text-muted-foreground">+{segment.scheduledDelay}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Timing entropy: {routePlan.obfuscationDetails.timingEntropyLevel}</span>
              <span className="mx-1">|</span>
              <span>Route diversity: {routePlan.obfuscationDetails.routeDiversityScore}%</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {!routePlan ? (
          <Button
            className="w-full"
            onClick={() => planMutation.mutate()}
            disabled={planMutation.isPending || !amount || parseFloat(amount) <= 0 || inputToken === outputToken}
            data-testid="button-plan-route"
          >
            {planMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Route className="h-4 w-4 mr-2" />
            )}
            Generate Private Route
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setRoutePlan(null)}
              data-testid="button-cancel-plan"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              className="flex-1"
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isPending}
              data-testid="button-execute-route"
            >
              {executeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Execute Route
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function PrivacyMetricsCard() {
  const { connected, publicKey } = useWalletContext();

  const { data: metrics, isLoading, error } = useQuery<PrivacyMetrics>({
    queryKey: ["/api/private-routing/metrics", publicKey],
    queryFn: async () => {
      const res = await fetch(`/api/private-routing/metrics?wallet=${publicKey}`);
      if (!res.ok) {
        throw new Error("Failed to fetch privacy metrics");
      }
      return res.json();
    },
    enabled: !!publicKey && connected,
  });

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Privacy Metrics
          </CardTitle>
          <CardDescription>Your routing privacy statistics</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Connect your wallet to view metrics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Privacy Metrics
        </CardTitle>
        <CardDescription>Your routing privacy statistics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Avg Privacy Score
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{metrics?.averagePrivacyScore ?? 0}</span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <Progress value={metrics?.averagePrivacyScore ?? 0} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Best Score
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{metrics?.bestPrivacyScore ?? 0}</span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <Progress value={metrics?.bestPrivacyScore ?? 0} className="h-2" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold">{metrics?.totalRoutedTransactions ?? 0}</div>
            <div className="text-xs text-muted-foreground">Routes Executed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-500">{metrics?.totalDecoysGenerated ?? 0}</div>
            <div className="text-xs text-muted-foreground">Decoys Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{(metrics?.routeDiversityScore ?? 0).toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Route Diversity</div>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <Label className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Timing Entropy
          </Label>
          <div className="flex items-center gap-2">
            <Progress value={(metrics?.averageTimingEntropy ?? 0) * 100} className="h-2 flex-1" />
            <span className="text-sm font-medium">{((metrics?.averageTimingEntropy ?? 0) * 100).toFixed(0)}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Higher entropy means better timing obfuscation</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RoutingHistoryCard() {
  const { connected, publicKey } = useWalletContext();

  const { data: history, isLoading, error } = useQuery<RoutingBatch[]>({
    queryKey: ["/api/private-routing/history", publicKey],
    queryFn: async () => {
      const res = await fetch(`/api/private-routing/history?wallet=${publicKey}`);
      if (!res.ok) {
        throw new Error("Failed to fetch routing history");
      }
      return res.json();
    },
    enabled: !!publicKey && connected,
  });

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Routing History
          </CardTitle>
          <CardDescription>Recent privacy-enhanced routes</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Connect your wallet to view history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const historyList = history || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Routing History
        </CardTitle>
        <CardDescription>Recent privacy-enhanced routes</CardDescription>
      </CardHeader>
      <CardContent>
        {historyList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No routing history yet</p>
            <p className="text-xs">Execute your first private route to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Privacy</TableHead>
                <TableHead>Segments</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyList.map((batch) => (
                <TableRow key={batch.batchId} data-testid={`row-batch-${batch.batchId}`}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      {batch.inputToken && batch.outputToken ? (
                        <>
                          <span>{batch.inputToken}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span>{batch.outputToken}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </div>
                    {batch.totalAmount && (
                      <div className="text-muted-foreground">{batch.totalAmount.toFixed(4)}</div>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(batch.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={batch.privacyScore} className="h-1.5 w-16" />
                      <span className="text-xs font-medium">{batch.privacyScore}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {batch.completedSegments}/{batch.totalSegments}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDate(batch.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function RoutingPage() {
  const { connected } = useWalletContext();
  const [activeTab, setActiveTab] = useState("planner");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Route className="h-6 w-6" />
            Private Routing Layer
          </h1>
          <p className="text-muted-foreground">
            Route obfuscation, decoy transactions, and timing randomization
          </p>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <Badge className="gap-1 bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" />
              Privacy Mode Active
            </Badge>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="planner" className="gap-2" data-testid="tab-planner">
            <Route className="h-4 w-4" />
            Route Planner
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            Privacy Settings
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2" data-testid="tab-metrics">
            <BarChart3 className="h-4 w-4" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planner" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <RoutePlannerCard />
            <PrivacyMetricsCard />
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <PrivacySettingsCard />
              <ZkModeConfigCard />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy Features
                </CardTitle>
                <CardDescription>How private routing protects your transactions</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Route className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Route Obfuscation</div>
                    <p className="text-sm text-muted-foreground">
                      Hides the actual DEX routing paths used for swaps, making it harder to trace transaction origins.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Shuffle className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div>
                    <div className="font-medium">Decoy Transactions</div>
                    <p className="text-sm text-muted-foreground">
                      Adds noise transactions that confuse blockchain observers and analytics tools.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Timer className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-medium">Timing Randomization</div>
                    <p className="text-sm text-muted-foreground">
                      Introduces random delays to break timing patterns that could reveal transaction relationships.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Layers className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <div className="font-medium">Transaction Splitting</div>
                    <p className="text-sm text-muted-foreground">
                      Breaks large transactions into smaller parts to reduce on-chain visibility and impact.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <Lock className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      Zero-Knowledge Proofs
                      <Badge className="bg-purple-500/20 text-purple-500 text-xs">Advanced</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Real ZK privacy using Light Protocol compressed tokens. Enable in ZK Mode settings for cryptographic transaction privacy.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid md:grid-cols-2 gap-6">
            <PrivacyMetricsCard />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Privacy Score Breakdown
                </CardTitle>
                <CardDescription>How your privacy score is calculated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <Shuffle className="h-4 w-4 text-purple-500" />
                      Decoy Density
                    </span>
                    <span className="text-sm font-medium">Up to 40 pts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <Timer className="h-4 w-4 text-blue-500" />
                      Timing Entropy
                    </span>
                    <span className="text-sm font-medium">Up to 30 pts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4 text-green-500" />
                      Transaction Splitting
                    </span>
                    <span className="text-sm font-medium">Up to 15 pts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <Route className="h-4 w-4 text-primary" />
                      Route Obfuscation
                    </span>
                    <span className="text-sm font-medium">Up to 15 pts</span>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between font-medium">
                    <span>Maximum Score</span>
                    <span>100 pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Higher scores indicate better transaction privacy protection
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <RoutingHistoryCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
