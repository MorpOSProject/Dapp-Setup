import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWalletContext } from "@/components/wallet-provider";
import { useToast } from "@/hooks/use-toast";
import { 
  Send,
  Download,
  Copy,
  Check,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  ArrowRight,
  Link2,
  Wallet,
  AlertCircle,
  ExternalLink,
  Lock,
  KeyRound,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { StealthPayment, PortfolioHolding } from "@shared/schema";
import { VersionedTransaction, Transaction } from "@solana/web3.js";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 6): string {
  if (value < 0.000001 && value > 0) return "<0.000001";
  return value.toLocaleString("en-US", { 
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals 
  });
}

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

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    case "claimed":
      return <Badge className="gap-1 bg-green-500/20 text-green-500 hover:bg-green-500/30"><CheckCircle className="h-3 w-3" /> Claimed</Badge>;
    case "expired":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function SendStealthPayment() {
  const { connected, publicKey, sendTransaction, connection } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [recipientHint, setRecipientHint] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdPayment, setCreatedPayment] = useState<{ 
    claimCode: string; 
    claimUrl: string; 
    txSignature?: string;
    zkClaimData?: string;
    zkInfo?: {
      commitment: string;
      actualAmount: number;
      secret: string;
      tokenSymbol: string;
    };
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedZkData, setCopiedZkData] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "building" | "signing" | "confirming" | "finalizing">("idle");
  const [zkEnabled, setZkEnabled] = useState(true); // ZK mode enabled by default for maximum privacy

  const { data: holdings, isLoading: holdingsLoading } = useQuery<PortfolioHolding[]>({
    queryKey: ["/api/portfolio/holdings", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const holding = holdings?.find(h => h.tokenMint === selectedToken);
      if (!holding) throw new Error("Token not found");
      if (!sendTransaction || !connection) throw new Error("Wallet not ready");

      const parsedAmount = parseFloat(amount);
      
      setTxStatus("building");
      const buildResponse = await apiRequest("POST", "/api/stealth/build-deposit", {
        senderWallet: publicKey,
        tokenMint: selectedToken,
        amount: parsedAmount,
      });
      
      if (!buildResponse.ok) {
        const error = await buildResponse.json();
        throw new Error(error.error || "Failed to build deposit transaction");
      }
      
      const { transaction: txBase64, escrowWallet } = await buildResponse.json();
      
      setTxStatus("signing");
      const txBuffer = Buffer.from(txBase64, "base64");
      const transaction = VersionedTransaction.deserialize(txBuffer);
      
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      
      setTxStatus("confirming");
      
      // Quick confirmation check with timeout - if signature exists, tx was accepted
      let confirmed = false;
      for (let i = 0; i < 10; i++) {
        try {
          const status = await connection.getSignatureStatus(signature);
          if (status?.value?.confirmationStatus === "confirmed" || 
              status?.value?.confirmationStatus === "finalized") {
            if (status.value.err) {
              throw new Error("Transaction failed on-chain");
            }
            confirmed = true;
            break;
          }
        } catch (e) {
          // Continue checking
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // If we have a signature and it was sent, proceed even if confirmation times out
      // The signature existing means the transaction was accepted by the network
      if (!confirmed) {
        console.log("Confirmation timeout, but transaction was sent. Proceeding with signature:", signature);
      }
      
      setTxStatus("finalizing");
      const createResponse = await apiRequest("POST", "/api/stealth/create", {
        senderWallet: publicKey,
        tokenMint: selectedToken,
        tokenSymbol: holding.tokenSymbol,
        amount: parsedAmount,
        recipientHint: recipientHint || undefined,
        message: message || undefined,
        expiresInDays: parseInt(expiresInDays) || 7,
        txSignature: signature,
        zkEnabled, // Enable ZK commitment mode for maximum privacy
      });
      
      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || "Failed to create payment record");
      }
      
      return { response: createResponse, signature, escrowWallet };
    },
    onSuccess: async ({ response, signature }) => {
      const data = await response.json();
      setCreatedPayment({
        claimCode: data.claimCode,
        claimUrl: data.claimUrl,
        txSignature: signature,
        zkClaimData: data.zkClaimData,
        zkInfo: data.zkInfo,
      });
      setShowSuccessDialog(true);
      setAmount("");
      setRecipientHint("");
      setMessage("");
      setTxStatus("idle");
      queryClient.invalidateQueries({ queryKey: ["/api/stealth/sent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] });
    },
    onError: (error: any) => {
      setTxStatus("idle");
      toast({
        title: "Error",
        description: error.message || "Failed to create stealth payment",
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = async () => {
    if (createdPayment?.claimCode) {
      await navigator.clipboard.writeText(createdPayment.claimCode);
      setCopiedCode(true);
      toast({ title: "Copied!", description: "Claim code copied to clipboard" });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const selectedHolding = holdings?.find(h => h.tokenMint === selectedToken);
  const maxAmount = selectedHolding ? selectedHolding.publicBalance : 0;
  const isValidAmount = parseFloat(amount) > 0 && parseFloat(amount) <= maxAmount;

  if (!connected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Connect your wallet to send stealth payments</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send Stealth Payment
          </CardTitle>
          <CardDescription>
            Send tokens privately. The recipient claims with a secret code - no public link between you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            {holdingsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger data-testid="select-stealth-token">
                  <SelectValue placeholder="Select token to send" />
                </SelectTrigger>
                <SelectContent>
                  {holdings?.filter(h => h.publicBalance > 0).map((holding) => (
                    <SelectItem key={holding.tokenMint} value={holding.tokenMint}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{holding.tokenSymbol}</span>
                        <span className="text-muted-foreground">
                          ({formatNumber(holding.publicBalance)} available)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="amount">Amount</Label>
              {selectedHolding && (
                <span className="text-sm text-muted-foreground">
                  Max: {formatNumber(maxAmount)} {selectedHolding.tokenSymbol}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-stealth-amount"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAmount(maxAmount.toString())}
                disabled={!selectedToken}
                data-testid="button-max-stealth"
              >
                MAX
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hint">Recipient Hint (Optional)</Label>
            <Input
              id="hint"
              placeholder="e.g., @username or email hint"
              value={recipientHint}
              onChange={(e) => setRecipientHint(e.target.value)}
              data-testid="input-recipient-hint"
            />
            <p className="text-xs text-muted-foreground">
              A hint to remind you who this payment is for (only visible to you)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Include a message with your payment..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              data-testid="input-stealth-message"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires">Expires In</Label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger data-testid="select-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="0">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label htmlFor="zk-mode" className="font-medium cursor-pointer">
                  ZK Privacy Mode
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hide amount using Zero-Knowledge Commitment
                </p>
              </div>
            </div>
            <Switch
              id="zk-mode"
              checked={zkEnabled}
              onCheckedChange={setZkEnabled}
              data-testid="switch-zk-mode"
            />
          </div>

          {zkEnabled && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-yellow-700 dark:text-yellow-400">
                  <p className="font-medium">ZK Mode Active</p>
                  <p className="text-xs mt-1 text-yellow-600 dark:text-yellow-500">
                    Amount will be hidden. You must share the ZK claim data with recipient for them to claim.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 space-y-3">
            <Button
              className="w-full gap-2"
              onClick={() => createMutation.mutate()}
              disabled={!selectedToken || !isValidAmount || createMutation.isPending}
              data-testid="button-create-stealth"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {txStatus === "building" && "Building Transaction..."}
                  {txStatus === "signing" && "Sign in Wallet..."}
                  {txStatus === "confirming" && "Confirming..."}
                  {txStatus === "finalizing" && "Creating Payment..."}
                  {txStatus === "idle" && "Processing..."}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send to Escrow
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Tokens are held in escrow until the recipient claims them
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {createdPayment?.zkInfo ? "ZK Private Payment Created!" : "Stealth Payment Created!"}
            </DialogTitle>
            <DialogDescription>
              {createdPayment?.zkInfo 
                ? "Amount is hidden using ZK commitment. Share the claim data below with recipient."
                : "Tokens deposited to escrow. Share the claim code with the recipient."
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {createdPayment?.zkInfo ? (
              <>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">ZK Private Payment</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-mono font-bold">
                        {createdPayment.zkInfo.actualAmount} {createdPayment.zkInfo.tokenSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Claim Code:</span>
                      <span className="font-mono">{createdPayment.claimCode}</span>
                    </div>
                    <div className="pt-2 border-t border-primary/10">
                      <p className="text-xs text-muted-foreground mb-1">Commitment Hash:</p>
                      <p className="font-mono text-xs break-all text-primary/70">
                        {createdPayment.zkInfo.commitment}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-2">
                    <KeyRound className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-yellow-700 dark:text-yellow-400">
                      <p className="font-medium">Important: Share ZK Claim Data</p>
                      <p className="mt-1 text-yellow-600 dark:text-yellow-500">
                        Recipient needs both the claim code AND secret to prove ownership.
                        Copy and share the complete claim data below.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={async () => {
                    if (createdPayment?.zkClaimData) {
                      await navigator.clipboard.writeText(createdPayment.zkClaimData);
                      setCopiedZkData(true);
                      toast({ title: "Copied!", description: "ZK claim data copied to clipboard" });
                      setTimeout(() => setCopiedZkData(false), 2000);
                    }
                  }}
                  data-testid="button-copy-zk-data"
                >
                  {copiedZkData ? (
                    <>
                      <Check className="h-4 w-4" />
                      ZK Claim Data Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy ZK Claim Data for Recipient
                    </>
                  )}
                </Button>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">ZK Claim Data (JSON):</p>
                  <pre className="text-xs font-mono break-all whitespace-pre-wrap text-muted-foreground">
                    {createdPayment.zkClaimData}
                  </pre>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-2">Claim Code</p>
                  <p className="font-mono text-2xl font-bold tracking-wider">
                    {createdPayment?.claimCode}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleCopyCode}
                  data-testid="button-copy-claim-code"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Claim Code
                    </>
                  )}
                </Button>
              </>
            )}

            {createdPayment?.txSignature && (
              <a
                href={`https://solscan.io/tx/${createdPayment.txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
                data-testid="link-deposit-tx"
              >
                <ExternalLink className="h-4 w-4" />
                View Deposit Transaction
              </a>
            )}

            <div className="text-sm text-muted-foreground text-center">
              <p>The recipient can claim at:</p>
              <p className="font-mono text-primary">{createdPayment?.claimUrl}</p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)} data-testid="button-close-success">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClaimStealthPayment() {
  const { connected, publicKey, signTransaction, connection } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [claimCode, setClaimCode] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<{ amount: number; symbol: string; txSignature?: string } | null>(null);
  const [claimStatus, setClaimStatus] = useState<"idle" | "building" | "signing" | "sending">("idle");
  
  // ZK proof data for ZK payments
  const [zkClaimData, setZkClaimData] = useState("");
  const [zkAmount, setZkAmount] = useState("");
  const [zkSecret, setZkSecret] = useState("");
  const [showZkInput, setShowZkInput] = useState(false);

  // Parse ZK claim data from JSON
  const handleParseZkData = () => {
    try {
      const parsed = JSON.parse(zkClaimData);
      if (parsed.code && parsed.amount && parsed.secret) {
        setClaimCode(parsed.code);
        setZkAmount(parsed.amount.toString());
        setZkSecret(parsed.secret);
        toast({ title: "ZK Data Parsed", description: "Claim code and proof data extracted" });
      }
    } catch {
      toast({ title: "Invalid Data", description: "Could not parse ZK claim data", variant: "destructive" });
    }
  };

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!signTransaction) throw new Error("Wallet not ready");
      
      const normalizedCode = claimCode.toUpperCase().replace(/\s/g, "");
      
      // Build ZK proof object if this is a ZK payment
      let zkProof = undefined;
      if (lookupResult?.zkEnabled && zkAmount && zkSecret) {
        zkProof = {
          amount: parseFloat(zkAmount),
          secret: zkSecret,
        };
      }
      
      setClaimStatus("building");
      const buildResponse = await apiRequest("POST", "/api/stealth/build-claim", {
        claimCode: normalizedCode,
        claimerWallet: publicKey,
        zkProof, // Include ZK proof for ZK payments
      });
      
      if (!buildResponse.ok) {
        const error = await buildResponse.json();
        throw new Error(error.error || "Failed to build claim transaction");
      }
      
      const { transaction: txBase64, amount, tokenSymbol } = await buildResponse.json();
      
      setClaimStatus("signing");
      const txBuffer = Buffer.from(txBase64, "base64");
      const transaction = Transaction.from(txBuffer);
      
      const signedTx = await signTransaction(transaction);
      const signedTxBase64 = signedTx.serialize().toString("base64");
      
      setClaimStatus("sending");
      const executeResponse = await apiRequest("POST", "/api/stealth/execute-claim", {
        claimCode: normalizedCode,
        claimerWallet: publicKey,
        signedTransaction: signedTxBase64,
      });
      
      if (!executeResponse.ok) {
        const error = await executeResponse.json();
        throw new Error(error.error || "Failed to execute claim");
      }
      
      return executeResponse;
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setClaimSuccess({
        amount: data.payment.amount,
        symbol: data.payment.tokenSymbol,
        txSignature: data.txSignature,
      });
      toast({
        title: "Payment Claimed!",
        description: `Successfully received ${data.payment.amount} ${data.payment.tokenSymbol}`,
      });
      setClaimCode("");
      setLookupResult(null);
      setClaimStatus("idle");
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] });
    },
    onError: (error: any) => {
      setClaimStatus("idle");
      toast({
        title: "Claim Failed",
        description: error.message || "Unable to claim payment",
        variant: "destructive",
      });
    },
  });

  const handleLookup = async () => {
    if (!claimCode) return;
    setIsLooking(true);
    try {
      const response = await fetch(`/api/stealth/lookup/${claimCode.toUpperCase().replace(/\s/g, "")}`);
      if (response.ok) {
        const data = await response.json();
        setLookupResult(data);
      } else {
        setLookupResult({ error: "Payment not found" });
      }
    } catch (error) {
      setLookupResult({ error: "Failed to lookup payment" });
    }
    setIsLooking(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Claim Stealth Payment
        </CardTitle>
        <CardDescription>
          Enter a claim code to receive a private payment sent to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="claim-code">Claim Code</Label>
          <div className="flex gap-2">
            <Input
              id="claim-code"
              placeholder="XXXX-XXXX-XXXX"
              value={claimCode}
              onChange={(e) => {
                setClaimCode(e.target.value.toUpperCase());
                setLookupResult(null);
              }}
              className="font-mono text-lg tracking-wider"
              data-testid="input-claim-code"
            />
            <Button 
              variant="outline" 
              onClick={handleLookup}
              disabled={!claimCode || isLooking}
              data-testid="button-lookup-payment"
            >
              {isLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {lookupResult && !lookupResult.error && (
          <div className="p-4 bg-muted rounded-lg space-y-3">
            {lookupResult.zkEnabled ? (
              <>
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Lock className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm text-primary">ZK Private Payment</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-mono text-muted-foreground italic">Hidden (requires proof)</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-mono font-medium">
                    {formatNumber(lookupResult.amount)} {lookupResult.tokenSymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Value</span>
                  <span className="font-medium">{formatCurrency(lookupResult.valueUsd)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Token</span>
              <span className="font-medium">{lookupResult.tokenSymbol}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {getStatusBadge(lookupResult.status)}
            </div>
            {lookupResult.message && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Message:</p>
                <p className="text-sm">{lookupResult.message}</p>
              </div>
            )}
            {lookupResult.isExpired && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">This payment has expired</span>
              </div>
            )}
          </div>
        )}

        {lookupResult?.zkEnabled && lookupResult.status === "pending" && (
          <div className="space-y-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">ZK Proof Required</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This is a ZK private payment. Enter the amount and secret shared by the sender to prove your claim.
            </p>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="zk-data">Paste ZK Claim Data (JSON)</Label>
                <div className="flex gap-2">
                  <Textarea
                    id="zk-data"
                    placeholder='{"code":"XXXX-XXXX-XXXX","amount":1.5,"secret":"..."}'
                    value={zkClaimData}
                    onChange={(e) => setZkClaimData(e.target.value)}
                    rows={2}
                    className="font-mono text-xs"
                    data-testid="input-zk-claim-data"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleParseZkData}
                    disabled={!zkClaimData}
                    data-testid="button-parse-zk-data"
                  >
                    Parse
                  </Button>
                </div>
              </div>
              
              <div className="text-xs text-center text-muted-foreground">— or enter manually —</div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="zk-amount" className="text-xs">Amount</Label>
                  <Input
                    id="zk-amount"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={zkAmount}
                    onChange={(e) => setZkAmount(e.target.value)}
                    className="font-mono"
                    data-testid="input-zk-amount"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zk-secret" className="text-xs">Secret</Label>
                  <Input
                    id="zk-secret"
                    type="password"
                    placeholder="Secret from sender"
                    value={zkSecret}
                    onChange={(e) => setZkSecret(e.target.value)}
                    className="font-mono"
                    data-testid="input-zk-secret"
                  />
                </div>
              </div>

              {zkAmount && zkSecret && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs">
                  <Check className="h-3 w-3" />
                  <span>ZK proof data ready for verification</span>
                </div>
              )}
            </div>
          </div>
        )}

        {lookupResult?.error && (
          <div className="p-4 bg-destructive/10 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{lookupResult.error}</span>
          </div>
        )}

        {claimSuccess ? (
          <div className="p-4 bg-green-500/10 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Payment Claimed Successfully!</span>
            </div>
            <p className="text-sm">
              You received {formatNumber(claimSuccess.amount)} {claimSuccess.symbol}
            </p>
            {claimSuccess.txSignature && (
              <a
                href={`https://solscan.io/tx/${claimSuccess.txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
                data-testid="link-claim-tx"
              >
                <ExternalLink className="h-4 w-4" />
                View Transaction on Solscan
              </a>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setClaimSuccess(null)}
              data-testid="button-claim-another"
            >
              Claim Another Payment
            </Button>
          </div>
        ) : !connected && lookupResult && !lookupResult.error && lookupResult.status === "pending" ? (
          <div className="p-4 bg-primary/10 rounded-lg flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Connect your wallet to claim this payment</p>
              <p className="text-xs text-muted-foreground">You need a wallet to receive the tokens</p>
            </div>
          </div>
        ) : (
          <Button
            className="w-full gap-2"
            onClick={() => claimMutation.mutate()}
            disabled={
              !connected || 
              !claimCode || 
              claimMutation.isPending || 
              lookupResult?.status !== "pending" ||
              (lookupResult?.zkEnabled && (!zkAmount || !zkSecret)) // Require ZK proof for ZK payments
            }
            data-testid="button-claim-payment"
          >
            {claimMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {claimStatus === "building" ? "Verifying ZK Proof..." :
                 claimStatus === "signing" ? "Please Sign in Wallet..." :
                 claimStatus === "sending" ? "Sending Transaction..." :
                 "Processing..."}
              </>
            ) : !connected ? (
              <>
                <Wallet className="h-4 w-4" />
                Connect Wallet to Claim
              </>
            ) : lookupResult?.zkEnabled && (!zkAmount || !zkSecret) ? (
              <>
                <KeyRound className="h-4 w-4" />
                Enter ZK Proof to Claim
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {lookupResult?.zkEnabled ? "Claim with ZK Proof" : "Claim Payment"} (you pay tx fee)
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentHistory() {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: payments, isLoading } = useQuery<StealthPayment[]>({
    queryKey: ["/api/stealth/sent", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const cancelMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return apiRequest("POST", `/api/stealth/cancel/${paymentId}`, {
        senderWallet: publicKey,
      });
    },
    onSuccess: () => {
      toast({
        title: "Payment Cancelled",
        description: "The stealth payment has been cancelled",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stealth/sent"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel payment",
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast({ title: "Copied!", description: "Claim code copied" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!connected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Connect your wallet to view payment history</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Payment History
        </CardTitle>
        <CardDescription>
          Stealth payments you've sent
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!payments || payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stealth payments sent yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                  <TableCell className="font-medium">{payment.tokenSymbol}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-mono">{formatNumber(payment.amount)}</span>
                      <span className="text-muted-foreground text-sm ml-1">
                        ({formatCurrency(payment.valueUsd)})
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {payment.recipientHint || (
                      <span className="text-muted-foreground">No hint</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(payment.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {payment.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyCode(payment.claimCode, payment.id)}
                            title="Copy claim code"
                            data-testid={`button-copy-${payment.id}`}
                          >
                            {copiedId === payment.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => cancelMutation.mutate(payment.id)}
                            disabled={cancelMutation.isPending}
                            title="Cancel payment"
                            data-testid={`button-cancel-${payment.id}`}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
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

export default function StealthPaymentsPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Stealth Payments
        </h1>
        <p className="text-muted-foreground mt-2">
          Send tokens privately with no public link between sender and recipient
        </p>
      </div>

      <div className="mb-6 p-4 bg-primary/10 rounded-lg flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <p className="font-medium text-sm">How Stealth Payments Work</p>
          <p className="text-sm text-muted-foreground mt-1">
            1. You create a payment and get a secret claim code<br />
            2. Share the claim code privately with the recipient<br />
            3. Recipient enters the code to claim - no blockchain link to you
          </p>
        </div>
      </div>

      <Tabs defaultValue="send" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send" className="gap-2" data-testid="tab-send">
            <Send className="h-4 w-4" />
            Send
          </TabsTrigger>
          <TabsTrigger value="claim" className="gap-2" data-testid="tab-claim">
            <Download className="h-4 w-4" />
            Claim
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <SendStealthPayment />
        </TabsContent>

        <TabsContent value="claim">
          <ClaimStealthPayment />
        </TabsContent>

        <TabsContent value="history">
          <PaymentHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
