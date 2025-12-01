import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, ArrowRight, ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import type { PortfolioHolding } from "@shared/schema";

interface MoveToShadowDialogProps {
  holding: PortfolioHolding;
  walletAddress: string;
  mode: "to-shadow" | "from-shadow";
  trigger?: React.ReactNode;
}

export function MoveToShadowDialog({ 
  holding, 
  walletAddress, 
  mode,
  trigger 
}: MoveToShadowDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [sliderValue, setSliderValue] = useState([0]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const maxAmount = mode === "to-shadow" 
    ? holding.publicBalance 
    : holding.shadowBalance;

  const moveToShadowMutation = useMutation({
    mutationFn: async () => {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error("Invalid amount");
      }
      
      const endpoint = mode === "to-shadow" 
        ? "/api/shadow-balances/move-to-shadow"
        : "/api/shadow-balances/move-from-shadow";
      
      return apiRequest("POST", endpoint, {
        walletAddress,
        tokenMint: holding.tokenMint,
        tokenSymbol: holding.tokenSymbol,
        amount: numAmount,
      });
    },
    onSuccess: () => {
      toast({
        title: mode === "to-shadow" ? "Moved to Shadow" : "Moved to Public",
        description: mode === "to-shadow" 
          ? `${amount} ${holding.tokenSymbol} is now shielded in your shadow balance`
          : `${amount} ${holding.tokenSymbol} is now visible in your public balance`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shadow-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setOpen(false);
      setAmount("");
      setSliderValue([0]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move tokens",
        variant: "destructive",
      });
    },
  });

  const handleSliderChange = (value: number[]) => {
    setSliderValue(value);
    const percentage = value[0] / 100;
    const newAmount = (maxAmount * percentage).toFixed(6);
    setAmount(newAmount);
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const numValue = parseFloat(value) || 0;
    const percentage = maxAmount > 0 ? Math.min((numValue / maxAmount) * 100, 100) : 0;
    setSliderValue([percentage]);
  };

  const handleMaxClick = () => {
    setAmount(maxAmount.toString());
    setSliderValue([100]);
  };

  const isToShadow = mode === "to-shadow";
  const Icon = isToShadow ? EyeOff : Eye;
  const ActionIcon = isToShadow ? ArrowRight : ArrowLeft;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
            data-testid={`button-${mode}-${holding.tokenSymbol}`}
          >
            <Icon className="h-4 w-4" />
            {isToShadow ? "Shield" : "Unshield"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {isToShadow ? "Move to Shadow Balance" : "Move to Public Balance"}
          </DialogTitle>
          <DialogDescription>
            {isToShadow 
              ? "Shield your tokens to make them private. Shadow balances are not visible on public blockchain explorers."
              : "Unshield your tokens to make them visible on-chain again."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold">{holding.tokenSymbol.slice(0, 2)}</span>
              </div>
              <div>
                <p className="font-medium">{holding.tokenSymbol}</p>
                <p className="text-sm text-muted-foreground">{holding.tokenName}</p>
              </div>
            </div>
            <Badge variant={isToShadow ? "secondary" : "default"}>
              {isToShadow ? "Public" : "Shadow"}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="amount">Amount</Label>
              <span className="text-sm text-muted-foreground">
                Available: {maxAmount.toFixed(6)} {holding.tokenSymbol}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                data-testid="input-shadow-amount"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleMaxClick}
                data-testid="button-max-amount"
              >
                MAX
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Slider
              value={sliderValue}
              onValueChange={handleSliderChange}
              max={100}
              step={1}
              className="w-full"
              data-testid="slider-shadow-amount"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">
                {isToShadow ? "Public" : "Shadow"}
              </p>
              <p className="font-mono font-medium">
                {maxAmount.toFixed(4)}
              </p>
            </div>
            <ActionIcon className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">
                {isToShadow ? "Shadow" : "Public"}
              </p>
              <p className="font-mono font-medium text-primary">
                {(parseFloat(amount) || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            data-testid="button-cancel-shadow"
          >
            Cancel
          </Button>
          <Button
            onClick={() => moveToShadowMutation.mutate()}
            disabled={moveToShadowMutation.isPending || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxAmount}
            className="gap-2"
            data-testid="button-confirm-shadow"
          >
            {moveToShadowMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Icon className="h-4 w-4" />
                {isToShadow ? "Shield Tokens" : "Unshield Tokens"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
