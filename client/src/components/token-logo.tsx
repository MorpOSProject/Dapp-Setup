const TOKEN_LOGOS: Record<string, string> = {
  SOL: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  USDC: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  RAY: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
  BONK: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
  JUP: "https://static.jup.ag/jup/icon.png",
  PYTH: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.png",
  MSOL: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
  ORCA: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png",
};

export function getTokenLogo(symbol: string): string | null {
  return TOKEN_LOGOS[symbol] || null;
}

interface TokenLogoProps {
  symbol: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function TokenLogo({ symbol, size = "md", className = "" }: TokenLogoProps) {
  const sizeClasses = {
    xs: "w-4 h-4",
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-10 h-10",
    xl: "w-12 h-12",
  };
  
  const textSizes = {
    xs: "text-[8px]",
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
    xl: "text-base",
  };
  
  const logoUrl = TOKEN_LOGOS[symbol];
  
  return (
    <div className={`${sizeClasses[size]} relative ${className}`}>
      {logoUrl ? (
        <>
          <img 
            src={logoUrl} 
            alt={`${symbol} logo`}
            className={`${sizeClasses[size]} rounded-full object-cover`}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) {
                (fallback as HTMLElement).classList.remove('hidden');
              }
            }}
          />
          <div className={`${sizeClasses[size]} rounded-full bg-muted flex items-center justify-center ${textSizes[size]} font-bold hidden`}>
            {symbol.slice(0, 2)}
          </div>
        </>
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-muted flex items-center justify-center ${textSizes[size]} font-bold`}>
          {symbol.slice(0, 2)}
        </div>
      )}
    </div>
  );
}

export { TOKEN_LOGOS };
