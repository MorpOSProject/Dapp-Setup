import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  PieChart, 
  Shield, 
  BarChart3, 
  Coins, 
  ClipboardCheck, 
  Globe, 
  Send, 
  Users, 
  Route,
  Zap,
  ExternalLink,
  Code2
} from "lucide-react";
import { SiX, SiGithub } from "react-icons/si";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { MorpLogo, MorpLogoWithText } from "@/components/morp-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function SolanaLogo({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 397.7 311.7" 
      className={className}
      fill="currentColor"
    >
      <linearGradient id="solana-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00FFA3" />
        <stop offset="50%" stopColor="#03E1FF" />
        <stop offset="100%" stopColor="#DC1FFF" />
      </linearGradient>
      <path 
        fill="url(#solana-gradient)"
        d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
      />
      <path 
        fill="url(#solana-gradient)"
        d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
      />
      <path 
        fill="url(#solana-gradient)"
        d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
      />
    </svg>
  );
}

const socialLinks = [
  {
    name: "X (Twitter)",
    url: "https://x.com/morposxyz",
    icon: SiX,
  },
  {
    name: "Website",
    url: "https://morpos.xyz/",
    icon: Globe,
  },
  {
    name: "GitHub",
    url: "https://github.com/MorpOSProject/MorpOSDapp/",
    icon: SiGithub,
  },
];

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    description: "Overview & stats",
  },
  {
    title: "Private Swap",
    url: "/swap",
    icon: ArrowLeftRight,
    description: "Trade tokens privately",
  },
  {
    title: "Stealth Pay",
    url: "/stealth",
    icon: Send,
    description: "Anonymous payments",
  },
  {
    title: "Multi-Sig",
    url: "/multisig",
    icon: Users,
    description: "Shared wallets",
  },
  {
    title: "Private Routing",
    url: "/routing",
    icon: Route,
    description: "ZK transaction routing",
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: PieChart,
    description: "Track your assets",
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    description: "Performance metrics",
  },
];

const defiNavItems = [
  {
    title: "Yield Farming",
    url: "/yield",
    icon: Coins,
    description: "Earn rewards",
  },
  {
    title: "Disclosure",
    url: "/disclosure",
    icon: Shield,
    description: "Selective proofs",
  },
  {
    title: "Compliance",
    url: "/compliance",
    icon: ClipboardCheck,
    description: "Audit controls",
  },
  {
    title: "ZK Dev Tools",
    url: "/zksnark",
    icon: Code2,
    description: "Build zkSNARK proofs",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 pb-6">
        {isCollapsed ? (
          <div className="flex justify-center">
            <MorpLogo size="sm" />
          </div>
        ) : (
          <MorpLogoWithText />
        )}
      </SidebarHeader>
      
      <SidebarContent className={isCollapsed ? "px-1" : "px-2"}>
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">
              Main
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link 
                          href={item.url} 
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          className={`
                            group/item relative flex items-center w-full rounded-lg transition-all duration-200
                            ${isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5"}
                            ${isActive 
                              ? "bg-primary/10 text-primary border border-primary/20" 
                              : "hover:bg-sidebar-accent/50 border border-transparent hover:border-sidebar-accent"
                            }
                          `}
                        >
                          <div className={`
                            p-1.5 rounded-md transition-all duration-200
                            ${isActive 
                              ? "bg-primary text-primary-foreground shadow-sm" 
                              : "bg-sidebar-accent/50 text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary group-hover/item:scale-110"
                            }
                          `}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          {!isCollapsed && (
                            <>
                              <span className={`font-medium text-sm ${isActive ? "text-primary" : "text-sidebar-foreground"}`}>
                                {item.title}
                              </span>
                              {isActive && (
                                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                              )}
                            </>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-muted-foreground text-xs">{item.description}</span>
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          {!isCollapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">
              DeFi & Privacy
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {defiNavItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link 
                          href={item.url} 
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          className={`
                            group/item relative flex items-center w-full rounded-lg transition-all duration-200
                            ${isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5"}
                            ${isActive 
                              ? "bg-primary/10 text-primary border border-primary/20" 
                              : "hover:bg-sidebar-accent/50 border border-transparent hover:border-sidebar-accent"
                            }
                          `}
                        >
                          <div className={`
                            p-1.5 rounded-md transition-all duration-200
                            ${isActive 
                              ? "bg-primary text-primary-foreground shadow-sm" 
                              : "bg-sidebar-accent/50 text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary group-hover/item:scale-110"
                            }
                          `}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          {!isCollapsed && (
                            <>
                              <span className={`font-medium text-sm ${isActive ? "text-primary" : "text-sidebar-foreground"}`}>
                                {item.title}
                              </span>
                              {isActive && (
                                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                              )}
                            </>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-muted-foreground text-xs">{item.description}</span>
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto pt-4">
          {!isCollapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">
              Network
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="mx-auto p-2 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] shadow-lg cursor-default"
                    data-testid="sidebar-network-status"
                  >
                    <SolanaLogo className="h-5 w-5 text-white" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span>Solana Mainnet-Beta</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div 
                className="mx-2 p-3 rounded-lg bg-gradient-to-br from-sidebar-accent/30 to-sidebar-accent/10 border border-sidebar-accent/50"
                data-testid="sidebar-network-status"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] shadow-lg">
                      <SolanaLogo className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-sidebar animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-sidebar-foreground">Solana</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-success/10 text-success border-success/30">
                        Live
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Mainnet-Beta</span>
                  </div>
                </div>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className={`border-t border-sidebar-border/50 ${isCollapsed ? "p-2" : "p-4 space-y-4"}`}>
        <div className={`flex items-center gap-1 ${isCollapsed ? "flex-col" : "justify-center"}`}>
          {socialLinks.map((social) => (
            <Tooltip key={social.name}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className={`rounded-lg hover:bg-sidebar-accent hover:scale-110 transition-all duration-200 ${isCollapsed ? "h-8 w-8" : "h-9 w-9"}`}
                  data-testid={`social-${social.name.toLowerCase().replace(/[^a-z]/g, "")}`}
                >
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <social.icon className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? "right" : "top"} className="flex items-center gap-1.5">
                <span>{social.name}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        
        {!isCollapsed && (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">MORP OS</span>
            </div>
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
              v1.0 Beta
            </Badge>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
