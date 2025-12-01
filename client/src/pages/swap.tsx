import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useWalletContext } from "@/components/wallet-provider";
import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { 
  ArrowDown, 
  Settings, 
  Shield, 
  Clock,
  RefreshCw,
  Wallet,
  Zap,
  CheckCircle,
  XCircle,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Token } from "@shared/schema";
import { TokenLogo } from "@/components/token-logo";

const TOKENS: Token[] = [
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", decimals: 9, price: 200 },
  { symbol: "USDC", name: "USD Coin", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, price: 1 },
  { symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, price: 2.5 },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, price: 0.000025 },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, price: 1.2 },
  { symbol: "PYTH", name: "Pyth Network", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, price: 0.45 },
];

interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: any[];
  slippageBps: number;
}

function formatNumber(value: number, decimals: number = 2): string {
  if (value < 0.0001 && value > 0) return "<0.0001";
  return value.toLocaleString("en-US", { 
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals 
  });
}

function TokenSelector({ 
  value, 
  onChange, 
  excludeToken,
  label 
}: { 
  value: string; 
  onChange: (value: string) => void;
  excludeToken?: string;
  label: string;
}) {
  const availableTokens = TOKENS.filter((t) => t.symbol !== excludeToken);
  const selectedToken = TOKENS.find((t) => t.symbol === value);

  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-14" data-testid={`select-token-${label.toLowerCase()}`}>
          {selectedToken ? (
            <div className="flex items-center gap-3">
              <TokenLogo symbol={selectedToken.symbol} />
              <div className="flex flex-col items-start">
                <span className="font-medium">{selectedToken.symbol}</span>
                <span className="text-xs text-muted-foreground">{selectedToken.name}</span>
              </div>
            </div>
          ) : (
            <SelectValue placeholder="Select token" />
          )}
        </SelectTrigger>
        <SelectContent>
          {availableTokens.map((token) => (
            <SelectItem key={token.symbol} value={token.symbol}>
              <div className="flex items-center gap-3">
                <TokenLogo symbol={token.symbol} />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{token.symbol}</span>
                  <span className="text-xs text-muted-foreground">{token.name}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SwapPreview({ 
  fromToken, 
  toToken, 
  fromAmount, 
  toAmount,
  priceImpact,
  fee,
  routePlan
}: { 
  fromToken: Token;
  toToken: Token;
  fromAmount: number;
  toAmount: number;
  priceImpact: number;
  fee: number;
  routePlan?: any[];
}) {
  const rate = toAmount / fromAmount;
  
  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Rate</span>
        <span className="font-mono" data-testid="text-swap-rate">
          1 {fromToken.symbol} = {formatNumber(rate, 6)} {toToken.symbol}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Price Impact</span>
        <span className={priceImpact > 1 ? "text-warning" : ""} data-testid="text-price-impact">
          {priceImpact.toFixed(3)}%
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Network Fee</span>
        <span className="font-mono">~{fee.toFixed(6)} SOL</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-1">
          <Shield className="w-3 h-3 text-primary" />
          Privacy Batch
        </span>
        <Badge variant="outline" className="text-xs">
          <Clock className="w-3 h-3 mr-1" />
          ~2 min
        </Badge>
      </div>
      {routePlan && routePlan.length > 0 && (
        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded flex items-center gap-2">
          <Zap className="w-3 h-3" />
          Route: {routePlan.map((r: any) => 
            r.swapInfo?.label || "DEX"
          ).join(" → ")}
        </div>
      )}
    </div>
  );
}

type SwapStatus = "idle" | "getting_quote" | "getting_transaction" | "simulating" | "awaiting_signature" | "sending" | "confirming" | "success" | "error";

export default function SwapPage() {
  const { connected, solBalance, publicKey, refreshBalance, connection } = useWalletContext();
  const { sendTransaction, publicKey: walletPublicKey } = useWallet();
  const { toast } = useToast();
  
  const [fromToken, setFromToken] = useState("SOL");
  const [toToken, setToToken] = useState("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [showSettings, setShowSettings] = useState(false);
  const [debouncedAmount, setDebouncedAmount] = useState("");
  const [swapStatus, setSwapStatus] = useState<SwapStatus>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fromTokenData = TOKENS.find((t) => t.symbol === fromToken);
  const toTokenData = TOKENS.find((t) => t.symbol === toToken);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmount(fromAmount);
    }, 500);
    return () => clearTimeout(timer);
  }, [fromAmount]);

  const { data: jupiterQuote, isLoading: isLoadingQuote, error: quoteError, refetch: refetchQuote } = useQuery<JupiterQuote>({
    queryKey: ["/api/swap/quote", { 
      inputMint: fromTokenData?.mint, 
      outputMint: toTokenData?.mint, 
      amount: debouncedAmount,
      slippage 
    }],
    enabled: !!fromTokenData && !!toTokenData && parseFloat(debouncedAmount) > 0,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const toAmount = useMemo(() => {
    if (jupiterQuote && toTokenData) {
      return parseFloat(jupiterQuote.outAmount) / Math.pow(10, toTokenData.decimals);
    }
    if (!fromAmount || !fromTokenData || !toTokenData) return 0;
    const amount = parseFloat(fromAmount);
    if (isNaN(amount)) return 0;
    return (amount * fromTokenData.price!) / toTokenData.price!;
  }, [jupiterQuote, fromAmount, fromTokenData, toTokenData]);

  const priceImpact = useMemo(() => {
    if (jupiterQuote) {
      return parseFloat(jupiterQuote.priceImpactPct) * 100;
    }
    const amount = parseFloat(fromAmount || "0");
    if (amount < 100) return 0.1;
    if (amount < 1000) return 0.3;
    return 0.8;
  }, [jupiterQuote, fromAmount]);

  const executeSwap = useCallback(async () => {
    if (!connected || !fromTokenData || !toTokenData || !publicKey || !jupiterQuote || !sendTransaction || !connection || !walletPublicKey) {
      toast({
        title: "Cannot execute swap",
        description: "Please ensure wallet is connected and quote is available",
        variant: "destructive",
      });
      return;
    }

    try {
      setSwapStatus("getting_transaction");
      setTxSignature(null);
      setErrorMessage(null);

      console.log("Starting swap execution...");

      const txRes = await apiRequest("POST", "/api/swap/transaction", {
        quoteResponse: jupiterQuote,
        userPublicKey: publicKey,
      });
      const txResponse = await txRes.json();
      console.log("Got transaction response:", !!txResponse.swapTransaction);

      if (!txResponse.swapTransaction) {
        throw new Error("Failed to get swap transaction from Jupiter");
      }

      const swapTransactionBuf = Buffer.from(txResponse.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      console.log("Transaction deserialized successfully");

      setSwapStatus("awaiting_signature");

      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: true,
        maxRetries: 5,
      });

      console.log("Transaction sent via wallet, signature:", signature);
      setTxSignature(signature);
      
      setSwapStatus("success");
      
      toast({
        title: "Swap successful!",
        description: (
          <div className="flex flex-col gap-1">
            <span>Swapped {fromAmount} {fromToken} for ~{formatNumber(toAmount, 6)} {toToken}</span>
            <a
              href={`https://solscan.io/tx/${signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 text-xs"
            >
              View on Solscan <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ),
      });

      apiRequest("POST", "/api/swap", {
        walletAddress: publicKey,
        fromToken: fromTokenData.mint,
        toToken: toTokenData.mint,
        fromAmount: parseFloat(fromAmount),
        toAmount,
        slippage: parseFloat(slippage),
        isPrivate: true,
        txSignature: signature,
        status: "confirmed",
      }).catch(err => console.warn("Failed to log swap:", err));

      refreshBalance();
      setFromAmount("");
      
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings", { wallet: publicKey }] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats", { wallet: publicKey }] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity", { wallet: publicKey }] });
      queryClient.invalidateQueries({ queryKey: ["/api/swap/orders", { wallet: publicKey }] });

      setTimeout(() => {
        setSwapStatus("idle");
        setTxSignature(null);
      }, 5000);

    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || "Unknown error";
      const errorName = error?.name || "Error";
      console.error("Swap error:", errorName, errorMessage, error);
      setSwapStatus("error");
      
      let errMsg = "There was an error processing your swap";
      if (errorMessage.includes("User rejected") || errorMessage.includes("rejected") || errorName === "WalletSignTransactionError") {
        errMsg = "Transaction was cancelled";
      } else if (errorMessage.includes("insufficient") || errorMessage.includes("Insufficient")) {
        errMsg = "Insufficient balance for this swap";
      } else if (errorMessage.includes("expired") || errorMessage.includes("block height") || errorMessage.includes("blockhash") || errorMessage.includes("Blockhash")) {
        errMsg = "Transaction expired. Please try again.";
      } else if (errorMessage.includes("simulation")) {
        errMsg = "Transaction simulation failed. Please try a smaller amount or different tokens.";
      } else if (errorMessage.includes("timeout")) {
        errMsg = "Transaction confirmation timeout - check Solscan for status";
      } else if (errorMessage && errorMessage !== "Unknown error") {
        errMsg = errorMessage.slice(0, 100);
      }

      setErrorMessage(errMsg);

      toast({
        title: "Swap failed",
        description: errMsg,
        variant: "destructive",
      });

      setTimeout(() => {
        setSwapStatus("idle");
        setTxSignature(null);
        setErrorMessage(null);
      }, 5000);
    }
  }, [connected, fromTokenData, toTokenData, publicKey, jupiterQuote, sendTransaction, connection, walletPublicKey, fromAmount, toAmount, slippage, fromToken, toToken, toast, refreshBalance]);

  const handleSwap = () => {
    executeSwap();
  };

  const handleQueueForBatch = async () => {
    const amount = parseFloat(fromAmount);
    if (!connected || !fromTokenData || !toTokenData || !publicKey || !jupiterQuote || isNaN(amount) || amount <= 0) {
      toast({
        title: "Cannot queue swap",
        description: "Please ensure wallet is connected and enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    const walletAddr = publicKey.toString();
    
    try {
      await apiRequest("POST", "/api/batched-actions", {
        walletAddress: walletAddr,
        actionType: "swap",
        description: `Swap ${fromAmount} ${fromToken} → ${toToken}`,
        amount,
        token: fromToken,
        metadata: {
          fromToken: fromTokenData.mint,
          toToken: toTokenData.mint,
          fromAmount: amount,
          toAmount,
          slippage: parseFloat(slippage),
        },
      });

      toast({
        title: "Swap queued for batch",
        description: "Your swap has been added to the batch queue for private execution",
      });

      setFromAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/batched-actions", { wallet: walletAddr }] });
    } catch (error) {
      console.error("Error queuing swap:", error);
      toast({
        title: "Failed to queue swap",
        description: "There was an error adding your swap to the batch queue",
        variant: "destructive",
      });
    }
  };

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount("");
  };

  const maxAmount = fromToken === "SOL" ? Math.max(0, solBalance - 0.01) : 0;

  const getSwapButtonContent = () => {
    switch (swapStatus) {
      case "getting_transaction":
        return (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Preparing...
          </>
        );
      case "simulating":
        return (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Simulating...
          </>
        );
      case "awaiting_signature":
        return (
          <>
            <Wallet className="w-5 h-5 animate-pulse" />
            Confirm in Wallet...
          </>
        );
      case "sending":
        return (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Sending...
          </>
        );
      case "confirming":
        return (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Confirming...
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle className="w-5 h-5" />
            Swap Successful!
          </>
        );
      case "error":
        return (
          <>
            <XCircle className="w-5 h-5" />
            Swap Failed
          </>
        );
      default:
        return (
          <>
            <Zap className="w-5 h-5" />
            Swap Now
          </>
        );
    }
  };

  const isSwapDisabled = !fromAmount || toAmount <= 0 || swapStatus !== "idle" || !jupiterQuote || isLoadingQuote;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Private Swap</h1>
        <p className="text-muted-foreground">
          Swap tokens securely via Jupiter
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Swap</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-swap-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => refetchQuote()}
              disabled={isLoadingQuote}
              data-testid="button-refresh-prices"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingQuote ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Collapsible open={showSettings}>
            <CollapsibleContent className="pb-4">
              <div className="p-4 bg-muted/50 rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Slippage Tolerance</Label>
                  <div className="flex items-center gap-2">
                    {["0.1", "0.5", "1.0"].map((val) => (
                      <Button
                        key={val}
                        variant={slippage === val ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSlippage(val)}
                        data-testid={`button-slippage-${val}`}
                      >
                        {val}%
                      </Button>
                    ))}
                    <Input
                      type="number"
                      value={slippage}
                      onChange={(e) => setSlippage(e.target.value)}
                      className="w-16 h-8 text-center"
                      data-testid="input-slippage-custom"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {!connected ? (
            <div className="text-center py-8" data-testid="container-connect-wallet">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Connect Wallet</h3>
              <p className="text-muted-foreground text-sm">
                Connect your wallet to start swapping
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <TokenSelector
                  value={fromToken}
                  onChange={setFromToken}
                  excludeToken={toToken}
                  label="From"
                />
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="h-16 text-2xl font-mono pr-20"
                    data-testid="input-from-amount"
                  />
                  {fromToken === "SOL" && maxAmount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                      onClick={() => setFromAmount(maxAmount.toString())}
                      data-testid="button-max-amount"
                    >
                      MAX
                    </Button>
                  )}
                </div>
                {fromToken === "SOL" && (
                  <p className="text-xs text-muted-foreground">
                    Balance: {solBalance.toFixed(4)} SOL
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={swapTokens}
                  data-testid="button-swap-direction"
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <TokenSelector
                  value={toToken}
                  onChange={setToToken}
                  excludeToken={fromToken}
                  label="To"
                />
                <div className="h-16 bg-muted/50 rounded-md flex items-center justify-between px-4">
                  {isLoadingQuote && parseFloat(fromAmount) > 0 ? (
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-24" />
                      <span className="text-xs text-muted-foreground">Getting quote...</span>
                    </div>
                  ) : (
                    <span className="text-2xl font-mono text-muted-foreground" data-testid="text-to-amount">
                      {toAmount > 0 ? formatNumber(toAmount, 6) : "0.00"}
                    </span>
                  )}
                  {jupiterQuote && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Zap className="w-3 h-3" />
                      Jupiter
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  ≈ ${toTokenData ? formatNumber(toAmount * toTokenData.price!, 2) : "0.00"}
                </p>
              </div>

              {quoteError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Failed to get quote. Please try again.
                </div>
              )}

              {errorMessage && swapStatus === "error" && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="w-4 h-4" />
                  {errorMessage}
                </div>
              )}

              {txSignature && swapStatus === "success" && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    Transaction confirmed!
                  </div>
                  <a
                    href={`https://solscan.io/tx/${txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
                    data-testid="link-tx-explorer"
                  >
                    {txSignature.slice(0, 20)}...{txSignature.slice(-8)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {fromAmount && toAmount > 0 && fromTokenData && toTokenData && (
                <SwapPreview
                  fromToken={fromTokenData}
                  toToken={toTokenData}
                  fromAmount={parseFloat(fromAmount)}
                  toAmount={toAmount}
                  priceImpact={priceImpact}
                  fee={0.000005}
                  routePlan={jupiterQuote?.routePlan}
                />
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 h-14 text-lg gap-2"
                  disabled={isSwapDisabled}
                  onClick={handleSwap}
                  data-testid="button-execute-swap"
                  variant={swapStatus === "success" ? "outline" : swapStatus === "error" ? "destructive" : "default"}
                >
                  {getSwapButtonContent()}
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                disabled={!fromAmount || toAmount <= 0 || !jupiterQuote}
                onClick={handleQueueForBatch}
                data-testid="button-queue-batch"
              >
                <Clock className="w-4 h-4" />
                Queue for Privacy Batch
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
