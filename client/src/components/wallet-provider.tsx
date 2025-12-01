import { useMemo, createContext, useContext, useState, useCallback, useEffect } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import "@solana/wallet-adapter-react-ui/styles.css";

type WalletContextType = {
  connected: boolean;
  publicKey: string | null;
  solBalance: number;
  connecting: boolean;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  connection: Connection | null;
  sendTransaction: WalletContextState["sendTransaction"] | null;
  signTransaction: WalletContextState["signTransaction"] | null;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const { connected, publicKey, connecting, disconnect, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [solBalance, setSolBalance] = useState(0);

  const refreshBalance = useCallback(async () => {
    if (!publicKey || !connected) {
      setSolBalance(0);
      return;
    }
    try {
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
        connection,
        sendTransaction: sendTransaction || null,
        signTransaction: signTransaction || null,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("mainnet-beta"), []);
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter({
        appIdentity: {
          name: "MORP OS",
          uri: window.location.origin,
          icon: `${window.location.origin}/favicon.png`,
        },
      }),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider 
      endpoint={endpoint}
      config={{
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      }}
    >
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
