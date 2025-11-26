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
  proofType: z.enum(["balance", "transaction", "full"]),
  recipientAddress: z.string().min(32, "Invalid Solana address"),
  recipientName: z.string().optional(),
  selectedItems: z.array(z.string()).min(1, "Select at least one item to disclose"),
  expiresAt: z.number().optional(),
});

type DisclosureFormData = z.infer<typeof disclosureFormSchema>;

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ExistingProofs() {
  const { connected, publicKey } = useWalletContext();
  
  const { data: proofs, isLoading } = useQuery<DisclosureProof[]>({
    queryKey: ["/api/disclosure/proofs", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const mockProofs: DisclosureProof[] = [
    {
      id: "1",
      walletAddress: "",
      proofType: "balance",
      recipientAddress: "AuD7...xK9m",
      recipientName: "Tax Auditor",
      selectedItems: ["SOL", "USDC"],
      createdAt: Date.now() - 86400000 * 3,
      expiresAt: Date.now() + 86400000 * 27,
      proofHash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      status: "active",
    },
    {
      id: "2",
      walletAddress: "",
      proofType: "transaction",
      recipientAddress: "Bx4F...8Hn2",
      recipientName: "Compliance Team",
      selectedItems: ["tx-001", "tx-002"],
      createdAt: Date.now() - 86400000 * 7,
      proofHash: "3f2c57e3c8b4d1a9e6f7a2b5c8d3e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7",
      status: "expired",
    },
  ];

  const displayProofs = proofs ?? mockProofs;

  if (!connected) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
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
      case "full": return "Full Disclosure";
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      {displayProofs.map((proof) => (
        <Card key={proof.id} data-testid={`proof-card-${proof.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
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
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1">
                  <Copy className="w-3 h-3" />
                  Copy Hash
                </Button>
                {proof.status === "active" && (
                  <Button variant="destructive" size="sm">
                    Revoke
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
    },
  });

  const { data: activities } = useQuery<Activity[]>({
    queryKey: ["/api/activity", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const mockActivities: Activity[] = activities ?? [
    { id: "tx-001", type: "swap", description: "SOL → USDC", amount: 10, token: "SOL", valueUsd: 2000, isPrivate: true, status: "completed", timestamp: Date.now() - 3600000, walletAddress: "" },
    { id: "tx-002", type: "deposit", description: "Marinade Stake", amount: 25, token: "SOL", valueUsd: 5000, isPrivate: true, status: "completed", timestamp: Date.now() - 7200000, walletAddress: "" },
    { id: "tx-003", type: "swap", description: "USDC → RAY", amount: 500, token: "USDC", valueUsd: 500, isPrivate: true, status: "completed", timestamp: Date.now() - 10800000, walletAddress: "" },
  ];

  const mockBalances = [
    { id: "SOL", label: "Solana (SOL)", value: "25.5 SOL" },
    { id: "USDC", label: "USD Coin (USDC)", value: "2,500 USDC" },
    { id: "RAY", label: "Raydium (RAY)", value: "500 RAY" },
  ];

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
    proofMutation.mutate({
      walletAddress: publicKey || "",
      proofType: data.proofType,
      recipientAddress: data.recipientAddress,
      recipientName: data.recipientName,
      selectedItems: data.selectedItems,
      expiresAt: data.expiresAt,
    });
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
                              <span>Balance Proof</span>
                              <span className="text-xs text-muted-foreground">Prove token balances at a point in time</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="transaction">
                            <div className="flex flex-col items-start">
                              <span>Transaction Proof</span>
                              <span className="text-xs text-muted-foreground">Prove specific transactions occurred</span>
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
                <FormField
                  control={form.control}
                  name="selectedItems"
                  render={() => (
                    <FormItem>
                      <FormLabel>
                        Select {proofType === "balance" ? "Balances" : "Transactions"} to Disclose
                      </FormLabel>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {proofType === "balance" ? (
                          mockBalances.map((balance) => (
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
                          mockActivities.map((activity) => (
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
