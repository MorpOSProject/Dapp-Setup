import { useMemo, createContext, useContext, useState, useCallback, useEffect } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

type WalletContextType = {
  connected: boolean;
  publicKey: string | null;
  solBalance: number;
  connecting: boolean;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const { connected, publicKey, connecting, disconnect } = useWallet();
  const [solBalance, setSolBalance] = useState(0);

  const refreshBalance = useCallback(async () => {
    if (!publicKey || !connected) {
      setSolBalance(0);
      return;
    }
    try {
      // Fetch balance from our server API (which uses Tatum RPC)
      const response = await fetch(`/api/portfolio/holdings?wallet=${publicKey.toBase58()}`);
      if (response.ok) {
        const holdings = await response.json();
        const solHolding = holdings.find((h: any) => h.symbol === "SOL");
        if (solHolding) {
          setSolBalance(solHolding.publicBalance || 0);
        }
      }
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  }, [publicKey, connected]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    
    if (connected && publicKey) {
      refreshBalance();
      interval = setInterval(refreshBalance, 30000);
    } else {
      setSolBalance(0);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [connected, publicKey, refreshBalance]);

  return (
    <WalletContext.Provider
      value={{
        connected,
        publicKey: publicKey?.toBase58() || null,
        solBalance,
        connecting,
        disconnect,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Use public mainnet RPC
  const endpoint = useMemo(() => clusterApiUrl("mainnet-beta"), []);
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
};

export { WalletMultiButton };
