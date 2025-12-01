import { Link, useLocation } from "wouter";
import { LayoutDashboard, ArrowLeftRight, PieChart, Shield, BarChart3, Coins, ClipboardCheck, Globe, Send, Users, Route } from "lucide-react";
import { SiX, SiGithub } from "react-icons/si";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { MorpLogoWithText } from "@/components/morp-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const socialLinks = [
  {
    name: "X",
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
  },
  {
    title: "Private Swap",
    url: "/swap",
    icon: ArrowLeftRight,
  },
  {
    title: "Stealth Pay",
    url: "/stealth",
    icon: Send,
  },
  {
    title: "Multi-Sig",
    url: "/multisig",
    icon: Users,
  },
  {
    title: "Private Routing",
    url: "/routing",
    icon: Route,
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: PieChart,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
];

const defiNavItems = [
  {
    title: "Yield Farming",
    url: "/yield",
    icon: Coins,
  },
  {
    title: "Disclosure",
    url: "/disclosure",
    icon: Shield,
  },
  {
    title: "Compliance",
    url: "/compliance",
    icon: ClipboardCheck,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <MorpLogoWithText />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="w-full"
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            DeFi & Privacy
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {defiNavItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="w-full"
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Network
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm text-muted-foreground">Solana Mainnet</span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          {socialLinks.map((social) => (
            <Button
              key={social.name}
              variant="ghost"
              size="icon"
              asChild
              className="h-8 w-8"
              data-testid={`social-${social.name.toLowerCase()}`}
            >
              <a
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                title={social.name}
              >
                <social.icon className="h-4 w-4" />
              </a>
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">MORP OS v1.0</span>
          <Badge variant="outline" className="text-xs">
            Beta
          </Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
