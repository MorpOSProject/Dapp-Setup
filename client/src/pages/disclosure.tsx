import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWalletContext } from "@/components/wallet-provider";
import { PrivacyShield } from "@/components/privacy-shield";
import { 
  Shield, 
  ShieldCheck,
  FileText, 
  Copy, 
  ExternalLink,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Key,
  User
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DisclosureProof, Activity, InsertDisclosureProof } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const disclosureFormSchema = z.object({
  proofType: z.enum(["balance", "transaction", "range", "merkle", "signature", "aggregated", "full"]),
  recipientAddress: z.string().min(32, "Invalid Solana address"),
  recipientName: z.string().optional(),
  selectedItems: z.array(z.string()).min(1, "Select at least one item to disclose"),
  expiresAt: z.number().optional(),
  rangeConfig: z.object({
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    label: z.string().optional(),
  }).optional(),
});

type DisclosureFormData = z.infer<typeof disclosureFormSchema>;

function formatDate(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ExistingProofs() {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();
  
  const { data: proofs, isLoading } = useQuery<DisclosureProof[]>({
    queryKey: ["/api/disclosure/proofs", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/disclosure/revoke/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Proof revoked",
        description: "The disclosure proof has been revoked successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/disclosure/proofs", { wallet: publicKey }] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/trail", { wallet: publicKey }] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke disclosure proof",
        variant: "destructive",
      });
    },
  });

  const copyProofHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      toast({
        title: "Copied",
        description: "Proof hash copied to clipboard",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  // Show connect wallet message when not connected
  if (!connected) {
    return (
      <Card data-testid="proofs-empty-state">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">Connect Wallet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Connect your wallet to view and manage your disclosure proofs.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Use real data only - no mock fallback
  const displayProofs = proofs || [];

  // Empty state
  if (displayProofs.length === 0) {
    return (
      <Card data-testid="proofs-empty-state">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No Proofs Created</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Generate your first disclosure proof to share specific financial information with auditors or compliance teams.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "revoked":
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case "expired":
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getProofTypeLabel = (type: string) => {
    switch (type) {
      case "balance": return "Balance Proof";
      case "transaction": return "Transaction Proof";
      case "range": return "Range Proof";
      case "merkle": return "Merkle Proof";
      case "signature": return "Signature Proof";
      case "aggregated": return "Aggregated Proof";
      case "full": return "Full Disclosure";
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      {displayProofs.map((proof) => (
        <Card key={proof.id} data-testid={`proof-card-${proof.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{getProofTypeLabel(proof.proofType)}</span>
                    <Badge 
                      variant={proof.status === "active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {getStatusIcon(proof.status)}
                      <span className="ml-1 capitalize">{proof.status}</span>
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {proof.recipientName || proof.recipientAddress}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Created: {formatDate(proof.createdAt)}
                    {proof.expiresAt && (
                      <> • Expires: {formatDate(proof.expiresAt)}</>
                    )}
                  </div>
                  {proof.proofHash && (
                    <div className="text-xs font-mono text-muted-foreground mt-2 p-2 bg-muted rounded break-all">
                      {proof.proofHash.slice(0, 32)}...
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1"
                  onClick={() => copyProofHash(proof.proofHash)}
                  data-testid={`button-copy-hash-${proof.id}`}
                >
                  <Copy className="w-3 h-3" />
                  Copy Hash
                </Button>
                {proof.status === "active" && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => revokeMutation.mutate(proof.id)}
                    disabled={revokeMutation.isPending}
                    data-testid={`button-revoke-${proof.id}`}
                  >
                    {revokeMutation.isPending ? "Revoking..." : "Revoke"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface PortfolioHolding {
  id: string;
  token: string;
  symbol: string;
  balance: number;
  shadowBalance: number;
  publicBalance: number;
  valueUsd: number;
  price: number;
}

function CreateProofForm() {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const form = useForm<DisclosureFormData>({
    resolver: zodResolver(disclosureFormSchema),
    defaultValues: {
      proofType: "balance",
      recipientAddress: "",
      recipientName: "",
      selectedItems: [],
      rangeConfig: {
        minValue: undefined,
        maxValue: undefined,
        label: "",
      },
    },
  });

  const { data: activities } = useQuery<Activity[]>({
    queryKey: ["/api/activity", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const { data: holdings } = useQuery<PortfolioHolding[]>({
    queryKey: ["/api/portfolio/holdings", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  // Use real holdings data
  const balances = (holdings || []).map(h => ({
    id: h.symbol,
    label: `${h.token} (${h.symbol})`,
    value: `${(h.balance || 0).toFixed(4)} ${h.symbol}`,
  }));

  // Use real activities, show empty state if none
  const displayActivities = activities || [];

  const proofMutation = useMutation({
    mutationFn: async (data: InsertDisclosureProof) => {
      return apiRequest("POST", "/api/disclosure/create", data);
    },
    onSuccess: () => {
      toast({
        title: "Proof generated",
        description: "Your disclosure proof has been created successfully",
      });
      form.reset();
      setStep(1);
      queryClient.invalidateQueries({ queryKey: ["/api/disclosure/proofs", { wallet: publicKey }] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/trail", { wallet: publicKey }] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate disclosure proof",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DisclosureFormData) => {
    const payload: any = {
      walletAddress: publicKey || "",
      proofType: data.proofType,
      recipientAddress: data.recipientAddress,
      recipientName: data.recipientName,
      selectedItems: data.selectedItems,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    };

    // Include range configuration for range proofs
    if (data.proofType === "range" && data.rangeConfig) {
      payload.rangeConfig = data.rangeConfig;
    }

    proofMutation.mutate(payload);
  };

  const proofType = form.watch("proofType");
  const selectedItems = form.watch("selectedItems");

  if (!connected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Connect your wallet to create selective disclosure proofs for auditors or compliance
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-privacy" />
          <CardTitle>Generate Disclosure Proof</CardTitle>
        </div>
        <CardDescription>
          Create cryptographic proofs to share specific financial information while keeping the rest private
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="proofType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proof Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-proof-type">
                            <SelectValue placeholder="Select proof type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="balance">
                            <div className="flex flex-col items-start">
                              <span>Balance Proof (Pedersen)</span>
                              <span className="text-xs text-muted-foreground">Prove token balances with cryptographic commitment</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="transaction">
                            <div className="flex flex-col items-start">
                              <span>Transaction Proof</span>
                              <span className="text-xs text-muted-foreground">Prove specific transactions occurred with hidden amounts</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="range">
                            <div className="flex flex-col items-start">
                              <span>Range Proof (Bulletproof)</span>
                              <span className="text-xs text-muted-foreground">Prove a value is within a range without revealing it</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="merkle">
                            <div className="flex flex-col items-start">
                              <span>Set Membership (Merkle)</span>
                              <span className="text-xs text-muted-foreground">Prove inclusion in a privacy set without revealing which element</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="signature">
                            <div className="flex flex-col items-start">
                              <span>Ownership Proof (Schnorr)</span>
                              <span className="text-xs text-muted-foreground">Prove wallet ownership via cryptographic signature</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="aggregated">
                            <div className="flex flex-col items-start">
                              <span>Aggregated Proof</span>
                              <span className="text-xs text-muted-foreground">Batch multiple proofs into a single verifiable unit</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="full">
                            <div className="flex flex-col items-start">
                              <span>Full Disclosure</span>
                              <span className="text-xs text-muted-foreground">Complete visibility of all activity</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipientAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Wallet Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter Solana address..." 
                          {...field}
                          data-testid="input-recipient-address"
                        />
                      </FormControl>
                      <FormDescription>
                        The wallet address that will be able to verify this proof
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Name (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Tax Auditor, Compliance Team..." 
                          {...field}
                          data-testid="input-recipient-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="button" 
                  onClick={() => setStep(2)}
                  className="w-full"
                  disabled={!form.watch("recipientAddress")}
                  data-testid="button-next-step"
                >
                  Continue to Select Items
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {proofType === "signature" && (
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Key className="w-4 h-4 text-privacy" />
                      Wallet Ownership Proof (Schnorr)
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This proof demonstrates that you control the private key for your connected wallet.
                      No items need to be selected - the proof will verify wallet ownership cryptographically.
                    </p>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground">Wallet to prove ownership:</p>
                      <p className="font-mono text-sm">{publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}</p>
                    </div>
                  </div>
                )}

                {proofType === "range" && (
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Shield className="w-4 h-4 text-privacy" />
                      Range Proof Configuration (Bulletproof-style)
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Prove that a value falls within a specific range without revealing the actual value.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="rangeConfig.minValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Value</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="e.g., 1000"
                                data-testid="input-range-min"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="rangeConfig.maxValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Value</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="e.g., 50000"
                                data-testid="input-range-max"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="rangeConfig.label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Range Label</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Portfolio Value, Transaction Amount"
                              data-testid="input-range-label"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {proofType === "merkle" && (
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Shield className="w-4 h-4 text-privacy" />
                      Set Membership Proof (Merkle Tree)
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Prove you are a member of a privacy set without revealing which specific member you are.
                    </p>
                  </div>
                )}

                {proofType === "aggregated" && (
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Shield className="w-4 h-4 text-privacy" />
                      Aggregated Batch Proof
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Combine multiple proofs into a single verifiable batch. Select the items to include in your aggregated proof.
                    </p>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="selectedItems"
                  render={() => (
                    <FormItem>
                      <FormLabel>
                        {proofType === "balance" && "Select Balances to Disclose"}
                        {proofType === "transaction" && "Select Transactions to Disclose"}
                        {proofType === "range" && "Select Values to Prove Range For"}
                        {proofType === "merkle" && "Select Items for Set Membership"}
                        {proofType === "aggregated" && "Select Items for Batch Proof"}
                        {proofType === "full" && "Select Items for Full Disclosure"}
                        {proofType === "signature" && "Confirm Wallet for Ownership Proof"}
                      </FormLabel>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(proofType === "balance" || proofType === "range" || proofType === "merkle" || proofType === "aggregated") ? (
                          balances.length > 0 ? (
                            balances.map((balance) => (
                              <FormField
                                key={balance.id}
                                control={form.control}
                                name="selectedItems"
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md hover-elevate">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(balance.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, balance.id])
                                            : field.onChange(field.value?.filter((v) => v !== balance.id));
                                        }}
                                        data-testid={`checkbox-balance-${balance.id}`}
                                      />
                                    </FormControl>
                                    <div className="flex-1">
                                      <FormLabel className="font-medium cursor-pointer">
                                        {balance.label}
                                      </FormLabel>
                                      <p className="text-sm text-muted-foreground font-mono">
                                        {balance.value}
                                      </p>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            ))
                          ) : (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                              No balances found. Connect your wallet to see holdings.
                            </div>
                          )
                        ) : proofType === "signature" ? (
                          <FormField
                            control={form.control}
                            name="selectedItems"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md hover-elevate">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("wallet-ownership")}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, "wallet-ownership"])
                                        : field.onChange(field.value?.filter((v) => v !== "wallet-ownership"));
                                    }}
                                    data-testid="checkbox-wallet-ownership"
                                  />
                                </FormControl>
                                <div className="flex-1">
                                  <FormLabel className="font-medium cursor-pointer">
                                    Confirm Wallet Ownership
                                  </FormLabel>
                                  <p className="text-sm text-muted-foreground">
                                    Generate cryptographic proof of wallet control
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        ) : (
                          displayActivities.length > 0 ? (
                            displayActivities.map((activity) => (
                              <FormField
                                key={activity.id}
                                control={form.control}
                                name="selectedItems"
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md hover-elevate">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(activity.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, activity.id])
                                            : field.onChange(field.value?.filter((v) => v !== activity.id));
                                        }}
                                        data-testid={`checkbox-tx-${activity.id}`}
                                      />
                                    </FormControl>
                                    <div className="flex-1">
                                      <FormLabel className="font-medium cursor-pointer">
                                        {activity.description}
                                      </FormLabel>
                                      <p className="text-sm text-muted-foreground">
                                        {formatDate(activity.timestamp)} • ${activity.valueUsd.toLocaleString()}
                                      </p>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            ))
                          ) : (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                              No transactions found. Complete some activity to create transaction proofs.
                            </div>
                          )
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit"
                    className="flex-1 gap-2"
                    disabled={selectedItems.length === 0 || proofMutation.isPending}
                    data-testid="button-generate-proof"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {proofMutation.isPending ? "Generating..." : "Generate Proof"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Shield className="w-4 h-4 text-privacy flex-shrink-0 mt-0.5" />
          <p>
            Disclosure proofs use zero-knowledge cryptography. The recipient can verify the proof 
            without accessing any other data. You can revoke proofs at any time.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function DisclosurePage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Selective Disclosure</h1>
        <p className="text-muted-foreground">
          Generate cryptographic proofs for auditors and compliance while keeping the rest private
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CreateProofForm />
        </div>
        <div className="space-y-4">
          <Card className="bg-privacy/5 border-privacy/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-privacy" />
                <span className="font-medium">How It Works</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-privacy/20 flex items-center justify-center text-xs text-privacy font-medium flex-shrink-0 mt-0.5">1</span>
                  Select what you want to prove
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-privacy/20 flex items-center justify-center text-xs text-privacy font-medium flex-shrink-0 mt-0.5">2</span>
                  Enter the recipient's address
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-privacy/20 flex items-center justify-center text-xs text-privacy font-medium flex-shrink-0 mt-0.5">3</span>
                  Generate cryptographic proof
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-privacy/20 flex items-center justify-center text-xs text-privacy font-medium flex-shrink-0 mt-0.5">4</span>
                  Share proof hash with recipient
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Existing Proofs</h2>
        <ExistingProofs />
      </div>
    </div>
  );
}
