import { Shield, ShieldCheck, ShieldOff, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PrivacyShieldProps {
  level?: "high" | "medium" | "low";
  className?: string;
}

export function PrivacyShield({ level = "high", className }: PrivacyShieldProps) {
  const icons = {
    high: ShieldCheck,
    medium: Shield,
    low: ShieldOff,
  };
  const colors = {
    high: "text-privacy",
    medium: "text-warning",
    low: "text-destructive",
  };
  const labels = {
    high: "High Privacy",
    medium: "Medium Privacy",
    low: "Low Privacy",
  };

  const Icon = icons[level];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1.5", className)}>
          <Icon className={cn("h-4 w-4", colors[level])} />
          <span className={cn("text-xs font-medium", colors[level])}>
            {labels[level]}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Privacy level: {labels[level]}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface MaskedValueProps {
  value: string;
  className?: string;
  defaultMasked?: boolean;
}

export function MaskedValue({ value, className, defaultMasked = true }: MaskedValueProps) {
  const [masked, setMasked] = useState(defaultMasked);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("font-mono transition-all", masked && "blur-sm select-none")}>
        {value}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setMasked(!masked)}
        data-testid="button-toggle-mask"
      >
        {masked ? (
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

interface PrivacyScoreProps {
  score: number;
  className?: string;
}

export function PrivacyScore({ score, className }: PrivacyScoreProps) {
  const getLevel = (s: number): "high" | "medium" | "low" => {
    if (s >= 80) return "high";
    if (s >= 50) return "medium";
    return "low";
  };

  const level = getLevel(score);
  const colors = {
    high: "text-privacy",
    medium: "text-warning",
    low: "text-destructive",
  };
  const bgColors = {
    high: "bg-privacy/20",
    medium: "bg-warning/20",
    low: "bg-destructive/20",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("flex items-center justify-center w-12 h-12 rounded-full", bgColors[level])}>
        <span className={cn("text-lg font-bold", colors[level])}>{score}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">Privacy Score</span>
        <span className={cn("text-xs", colors[level])}>
          {level === "high" && "Excellent protection"}
          {level === "medium" && "Could be improved"}
          {level === "low" && "Needs attention"}
        </span>
      </div>
    </div>
  );
}
