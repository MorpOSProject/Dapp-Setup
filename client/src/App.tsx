import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WalletButton } from "@/components/wallet-button";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import SwapPage from "@/pages/swap";
import PortfolioPage from "@/pages/portfolio";
import DisclosurePage from "@/pages/disclosure";
import AnalyticsPage from "@/pages/analytics";
import YieldPage from "@/pages/yield";
import CompliancePage from "@/pages/compliance";
import StealthPage from "@/pages/stealth";
import MultisigPage from "@/pages/multisig";
import RoutingPage from "@/pages/routing";
import ZkSnarkPage from "@/pages/zksnark";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/swap" component={SwapPage} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/stealth" component={StealthPage} />
      <Route path="/multisig" component={MultisigPage} />
      <Route path="/routing" component={RoutingPage} />
      <Route path="/zksnark" component={ZkSnarkPage} />
      <Route path="/disclosure" component={DisclosurePage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/yield" component={YieldPage} />
      <Route path="/compliance" component={CompliancePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const sidebarStyle = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/40 px-4 sticky top-0 z-50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-3">
              <SidebarTrigger 
                data-testid="button-sidebar-toggle"
                className="h-9 w-9 rounded-lg hover:bg-accent/80 transition-all duration-200 hover:scale-105"
              />
              <div 
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/30"
                data-testid="network-status-indicator"
              >
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-medium text-muted-foreground">Mainnet</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WalletButton />
              <div className="w-px h-6 bg-border/50 mx-1 hidden sm:block" />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-gradient-to-b from-background to-background/95">
            <Router />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WalletProvider>
          <TooltipProvider>
            <AppLayout />
            <Toaster />
          </TooltipProvider>
        </WalletProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
