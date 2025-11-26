import logoUrl from "@assets/mmmmmm_1764163251418.png";

interface MorpLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function MorpLogo({ className = "", size = "md" }: MorpLogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <img
      src={logoUrl}
      alt="MORP OS Logo"
      className={`${sizeClasses[size]} object-contain ${className}`}
    />
  );
}

export function MorpLogoWithText({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <MorpLogo size="md" />
      <div className="flex flex-col">
        <span className="font-bold text-lg leading-tight tracking-tight">MORP</span>
        <span className="text-xs text-muted-foreground leading-tight -mt-0.5">OS</span>
      </div>
    </div>
  );
}
