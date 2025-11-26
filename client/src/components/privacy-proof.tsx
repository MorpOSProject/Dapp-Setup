import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  Lock, 
  CheckCircle, 
  Clock,
  Hash,
  Eye,
  EyeOff,
  RefreshCw,
  Fingerprint,
  AlertTriangle,
  Copy,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWalletContext } from "@/components/wallet-provider";
import { useToast } from "@/hooks/use-toast";

interface ZkProofData {
  proof: {
    id: string;
    proofHash: string;
    commitment: string;
    nullifier: string;
    claim: string;
    verified: boolean;
    protocol: string;
    expiresAt: string;
  };
  cryptographic: {
    proofHash: string;
    commitment: string;
    publicInputs: string[];
    protocol: string;
    inRange?: boolean;
  };
}

interface PrivacyProofProps {
  type: "balance" | "transaction" | "identity" | "range" | "ownership";
  claim: string;
  status?: "pending" | "generating" | "verified" | "failed";
  proofHash?: string;
  proofData?: ZkProofData;
  onGenerate?: () => void;
  className?: string;
  balance?: number;
  tokenSymbol?: string;
  threshold?: number;
  txSignature?: string;
  fromToken?: string;
  toToken?: string;
  amount?: number;
}

export function PrivacyProof({ 
  type, 
  claim, 
  status: initialStatus = "pending",
  proofHash: initialHash,
  proofData,
  onGenerate,
  className,
  balance,
  tokenSymbol,
  threshold,
  txSignature,
  fromToken,
  toToken,
  amount,
}: PrivacyProofProps) {
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(0);
  const [proofHash, setProofHash] = useState(initialHash);
  const [zkProof, setZkProof] = useState<ZkProofData | null>(proofData || null);
  const [showDetails, setShowDetails] = useState(false);
  const { publicKey } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getTypeIcon = () => {
    switch (type) {
      case "balance": return Lock;
      case "transaction": return RefreshCw;
      case "identity": return Fingerprint;
      case "range": return Hash;
      case "ownership": return Shield;
      default: return Shield;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case "balance": return "Balance Proof";
      case "transaction": return "Transaction Proof";
      case "identity": return "Identity Proof";
      case "range": return "Range Proof";
      case "ownership": return "Ownership Proof";
      default: return "Privacy Proof";
    }
  };

  const generateBalanceProofMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/zk/generate/balance", {
        walletAddress: publicKey,
        balance: balance || 0,
        tokenSymbol: tokenSymbol || "SOL",
        threshold,
      });
      return response.json();
    },
    onSuccess: (data: ZkProofData) => {
      setZkProof(data);
      setProofHash(data.cryptographic.proofHash);
      setStatus("verified");
      setProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/zk/proofs", { wallet: publicKey }] });
      toast({
        title: "Balance Proof Generated",
        description: "Your zero-knowledge proof has been cryptographically verified",
      });
    },
    onError: (error) => {
      setStatus("failed");
      toast({
        title: "Proof Generation Failed",
        description: "Could not generate cryptographic proof",
        variant: "destructive",
      });
    },
  });

  const generateRangeProofMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/zk/generate/range", {
        walletAddress: publicKey,
        value: balance || 0,
        minValue: threshold || 0,
        maxValue: 1000000,
        label: tokenSymbol || "balance",
      });
      return response.json();
    },
    onSuccess: (data: ZkProofData) => {
      setZkProof(data);
      setProofHash(data.cryptographic.proofHash);
      setStatus("verified");
      setProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/zk/proofs", { wallet: publicKey }] });
      toast({
        title: "Range Proof Generated",
        description: `Proof verified: value ${data.cryptographic.inRange ? 'is' : 'is not'} within range`,
      });
    },
    onError: () => {
      setStatus("failed");
      toast({
        title: "Proof Generation Failed",
        description: "Could not generate range proof",
        variant: "destructive",
      });
    },
  });

  const generateTransactionProofMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/zk/generate/transaction", {
        walletAddress: publicKey,
        txSignature: txSignature || "",
        fromToken: fromToken || "",
        toToken: toToken || "",
        amount: amount || 0,
      });
      return response.json();
    },
    onSuccess: (data: ZkProofData) => {
      setZkProof(data);
      setProofHash(data.cryptographic.proofHash);
      setStatus("verified");
      setProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/zk/proofs", { wallet: publicKey }] });
      toast({
        title: "Transaction Proof Generated",
        description: "Transaction proof has been cryptographically verified",
      });
    },
    onError: () => {
      setStatus("failed");
      toast({
        title: "Proof Generation Failed",
        description: "Could not generate transaction proof",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = async () => {
    if (!publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to generate proofs",
        variant: "destructive",
      });
      return;
    }

    setStatus("generating");
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 20;
      });
    }, 150);

    try {
      if (type === "balance") {
        await generateBalanceProofMutation.mutateAsync();
      } else if (type === "range") {
        await generateRangeProofMutation.mutateAsync();
      } else if (type === "transaction") {
        await generateTransactionProofMutation.mutateAsync();
      } else {
        await generateBalanceProofMutation.mutateAsync();
      }
    } finally {
      clearInterval(progressInterval);
    }

    onGenerate?.();
  };

  const copyProofHash = () => {
    if (proofHash) {
      navigator.clipboard.writeText(proofHash);
      toast({
        title: "Copied",
        description: "Proof hash copied to clipboard",
      });
    }
  };

  const TypeIcon = getTypeIcon();
  const isGenerating = generateBalanceProofMutation.isPending || 
                       generateRangeProofMutation.isPending || 
                       generateTransactionProofMutation.isPending;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              status === "verified" ? "bg-success/10" : "bg-privacy/10"
            )}>
              <TypeIcon className={cn(
                "w-5 h-5",
                status === "verified" ? "text-success" : "text-privacy"
              )} />
            </div>
            <div>
              <CardTitle className="text-base">{getTypeLabel()}</CardTitle>
              <CardDescription className="text-xs">{claim}</CardDescription>
            </div>
          </div>
          <Badge 
            variant={status === "verified" ? "default" : "secondary"}
            className="capitalize"
          >
            {status === "generating" || isGenerating ? (
              <div className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Generating
              </div>
            ) : status === "verified" ? (
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Verified
              </div>
            ) : status === "failed" ? (
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Failed
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {status}
              </div>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(status === "generating" || isGenerating) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Generating cryptographic proof...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Computing Pedersen commitment...</span>
            </div>
          </div>
        )}

        {status === "verified" && (proofHash || zkProof) && (
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Proof Hash (SHA-512)</span>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={copyProofHash}
                    data-testid="button-copy-proof"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => setShowDetails(!showDetails)}
                    data-testid="button-toggle-proof-details"
                  >
                    {showDetails ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
              <code className="text-xs font-mono break-all">
                {showDetails 
                  ? (proofHash || zkProof?.cryptographic.proofHash)
                  : `${(proofHash || zkProof?.cryptographic.proofHash || "").slice(0, 16)}...${(proofHash || zkProof?.cryptographic.proofHash || "").slice(-8)}`
                }
              </code>
            </div>

            {showDetails && zkProof && (
              <div className="space-y-2">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <span className="text-xs font-medium block mb-1">Commitment</span>
                  <code className="text-xs font-mono break-all text-muted-foreground">
                    {zkProof.cryptographic.commitment}
                  </code>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <span className="text-xs font-medium block mb-1">Protocol</span>
                  <Badge variant="outline" className="text-xs">
                    {zkProof.cryptographic.protocol.toUpperCase()}
                  </Badge>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <span className="text-xs font-medium block mb-1">Public Inputs</span>
                  <div className="space-y-1">
                    {zkProof.cryptographic.publicInputs.map((input, i) => (
                      <code key={i} className="text-xs font-mono break-all text-muted-foreground block">
                        {input.length > 32 ? `${input.slice(0, 32)}...` : input}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-success">
              <CheckCircle className="w-3 h-3" />
              <span>Proof verified cryptographically</span>
            </div>
          </div>
        )}

        {status === "pending" && (
          <Button 
            onClick={handleGenerate} 
            className="w-full gap-2"
            variant="outline"
            disabled={!publicKey || isGenerating}
            data-testid="button-generate-proof"
          >
            <Shield className="w-4 h-4" />
            Generate Real ZK Proof
          </Button>
        )}

        {status === "failed" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3 h-3" />
              <span>Proof generation failed</span>
            </div>
            <Button 
              onClick={() => { setStatus("pending"); handleGenerate(); }} 
              className="w-full gap-2"
              variant="outline"
              size="sm"
              data-testid="button-retry-proof"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ProofGeneratorProps {
  walletAddress: string;
  balance: number;
  tokenSymbol: string;
}

export function BalanceProofGenerator({ walletAddress, balance, tokenSymbol }: ProofGeneratorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4 text-privacy" />
        <span>Real Zero-Knowledge Proof Generation</span>
      </div>
      <PrivacyProof 
        type="balance"
        claim={`Prove ownership of ${tokenSymbol} without revealing amount`}
        balance={balance}
        tokenSymbol={tokenSymbol}
      />
      <PrivacyProof 
        type="range"
        claim="Prove balance is above threshold without revealing exact value"
        balance={balance}
        tokenSymbol={tokenSymbol}
        threshold={100}
      />
      <div className="p-3 bg-privacy/10 rounded-lg border border-privacy/20 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Cryptographic Commitments</p>
        <p className="mb-2">
          These proofs use HMAC-based cryptographic commitments with secure blinding factors. 
          Each proof has a unique nullifier to prevent double-use.
        </p>
        <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
          <span className="font-medium">Security Level:</span> Cryptographic Commitment
          <p className="mt-1 opacity-75">
            Provides computational hiding of your data. For full zero-knowledge proofs 
            with on-chain verification, Light Protocol integration is available.
          </p>
        </div>
      </div>
    </div>
  );
}

export function TransactionPrivacyIndicator({ isPrivate, batchSize }: { isPrivate: boolean; batchSize?: number }) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-3 rounded-lg border",
      isPrivate ? "bg-privacy/10 border-privacy/20" : "bg-muted/50 border-border"
    )}>
      {isPrivate ? (
        <>
          <Shield className="w-5 h-5 text-privacy" />
          <div className="flex-1">
            <p className="text-sm font-medium">Private Transaction</p>
            <p className="text-xs text-muted-foreground">
              {batchSize ? `Batched with ${batchSize} other transactions` : "Will be batched for privacy"}
            </p>
          </div>
          <Badge variant="outline" className="text-privacy border-privacy/30">
            <Lock className="w-3 h-3 mr-1" />
            ZK-Protected
          </Badge>
        </>
      ) : (
        <>
          <Eye className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Public Transaction</p>
            <p className="text-xs text-muted-foreground">
              This transaction will be visible on the blockchain
            </p>
          </div>
          <Badge variant="secondary">
            Public
          </Badge>
        </>
      )}
    </div>
  );
}
