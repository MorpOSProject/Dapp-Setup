import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletContext } from "@/components/wallet-provider";
import { 
  Shield,
  Plus,
  Wallet,
  Download,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Hash,
  Calendar,
  Settings,
  Trash2
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import type { ComplianceRule, AuditTrailEntry, InsertComplianceRule } from "@shared/schema";
import { format } from "date-fns";

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM dd, yyyy HH:mm");
}

const RULE_TYPES = [
  { value: "transaction_limit", label: "Transaction Limit", description: "Set maximum transaction amounts" },
  { value: "disclosure_threshold", label: "Disclosure Threshold", description: "Auto-disclose above certain values" },
  { value: "address_whitelist", label: "Address Whitelist", description: "Restrict to approved addresses" },
  { value: "time_restriction", label: "Time Restriction", description: "Limit transactions to specific times" },
  { value: "token_restriction", label: "Token Restriction", description: "Restrict specific tokens" },
];

const ACTION_TYPES = [
  { value: "alert", label: "Alert Only" },
  { value: "block", label: "Block Transaction" },
  { value: "auto_disclose", label: "Auto Disclose" },
  { value: "require_approval", label: "Require Approval" },
];

const ruleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  ruleType: z.string().min(1, "Rule type is required"),
  actions: z.object({
    type: z.string(),
    params: z.record(z.any()).optional(),
  }),
  conditions: z.record(z.any()),
  isActive: z.boolean(),
});

function RuleCard({ rule, onDelete }: { rule: ComplianceRule; onDelete: () => void }) {
  const { toast } = useToast();
  const { publicKey } = useWalletContext();

  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      return apiRequest("PATCH", `/api/compliance/rules/${rule.id}`, { isActive: active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/rules", { wallet: publicKey }] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/trail", { wallet: publicKey }] });
      toast({
        title: rule.isActive ? "Rule disabled" : "Rule enabled",
        description: `${rule.name} has been ${rule.isActive ? "disabled" : "enabled"}`,
      });
    },
  });

  const ruleTypeInfo = RULE_TYPES.find((t) => t.value === rule.ruleType);
  const actionType = (rule.actions as any)?.type || "alert";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${rule.isActive ? "bg-success/10" : "bg-muted"}`}>
              {rule.isActive ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">{rule.name}</CardTitle>
              <CardDescription>{ruleTypeInfo?.label || rule.ruleType}</CardDescription>
            </div>
          </div>
          <Switch
            checked={rule.isActive}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            disabled={toggleMutation.isPending}
            data-testid={`switch-rule-${rule.id}`}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Action</span>
            <Badge variant="outline" className="capitalize">
              {actionType.replace("_", " ")}
            </Badge>
          </div>
          {rule.conditions && Object.keys(rule.conditions).length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Conditions</span>
              <span className="font-mono text-xs">
                {Object.entries(rule.conditions).map(([k, v]) => `${k}: ${v}`).join(", ").slice(0, 40)}
              </span>
            </div>
          )}
          {rule.description && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Description</span>
              <span className="text-xs text-right max-w-[200px] truncate">{rule.description}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created</span>
            <span className="text-xs">{formatDate(rule.createdAt)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" className="flex-1" data-testid={`button-edit-rule-${rule.id}`}>
          <Settings className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button 
          variant="destructive" 
          size="sm"
          onClick={onDelete}
          data-testid={`button-delete-rule-${rule.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function CreateRuleDialog() {
  const { publicKey } = useWalletContext();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof ruleFormSchema>>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      ruleType: "",
      actions: { type: "alert", params: {} },
      conditions: {},
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertComplianceRule) => {
      return apiRequest("POST", "/api/compliance/rules", data);
    },
    onSuccess: () => {
      toast({
        title: "Rule created",
        description: "Your compliance rule has been created successfully",
      });
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/rules", { wallet: publicKey }] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/trail", { wallet: publicKey }] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create rule",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof ruleFormSchema>) => {
    if (!publicKey) return;
    
    createMutation.mutate({
      walletAddress: publicKey,
      name: values.name,
      description: values.description || null,
      ruleType: values.ruleType,
      conditions: values.conditions as Record<string, any>,
      actions: values.actions as Record<string, any>,
      isActive: values.isActive,
    });
  };

  const selectedRuleType = form.watch("ruleType");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-rule">
          <Plus className="w-4 h-4" />
          New Rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Compliance Rule</DialogTitle>
          <DialogDescription>
            Set up automated compliance rules for your transactions
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Large Transaction Alert" data-testid="input-rule-name" />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ruleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-rule-type">
                        <SelectValue placeholder="Select rule type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RULE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div>{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {selectedRuleType === "transaction_limit" && (
              <FormField
                control={form.control}
                name="conditions.maxAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Amount (USD)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="10000"
                        data-testid="input-max-amount"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {selectedRuleType === "disclosure_threshold" && (
              <FormField
                control={form.control}
                name="conditions.threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disclosure Threshold (USD)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="5000"
                        data-testid="input-threshold"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="actions.type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-action">
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTION_TYPES.map((action) => (
                        <SelectItem key={action.value} value={action.value}>
                          {action.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <FormLabel className="text-base">Enable Rule</FormLabel>
                    <FormDescription className="text-xs">
                      Rule will be active immediately
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-enable"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} type="button">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="gap-2"
                data-testid="button-submit-rule"
              >
                {createMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Rule"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AuditTrailTable() {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();

  const { data: auditTrail, isLoading } = useQuery<AuditTrailEntry[]>({
    queryKey: ["/api/audit/trail", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const displayTrail = auditTrail || [];

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/audit/export?wallet=${publicKey}`);
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${publicKey?.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Audit trail exported",
        description: "Your audit trail has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export audit trail",
        variant: "destructive",
      });
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "swap_initiated":
        return <RefreshCw className="w-4 h-4" />;
      case "disclosure_created":
        return <Eye className="w-4 h-4" />;
      case "disclosure_revoked":
        return <EyeOff className="w-4 h-4" />;
      case "yield_strategy_created":
        return <CheckCircle className="w-4 h-4" />;
      case "compliance_rule_created":
        return <Shield className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (displayTrail.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled data-testid="button-export-audit">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Audit Trail Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your cryptographic audit trail will appear here as you perform actions
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="outline" className="gap-2" onClick={handleExport} data-testid="button-export-audit">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Proof Hash</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayTrail.map((entry) => (
            <TableRow key={entry.id} data-testid={`audit-row-${entry.id}`}>
              <TableCell>
                <div className="p-2 bg-muted rounded-full">
                  {getEventIcon(entry.eventType)}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {entry.eventType.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {entry.description}
              </TableCell>
              <TableCell>
                {entry.proofHash ? (
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {entry.proofHash.slice(0, 10)}...{entry.proofHash.slice(-6)}
                  </code>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(entry.timestamp)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function CompliancePage() {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();

  const { data: rules, isLoading: rulesLoading } = useQuery<ComplianceRule[]>({
    queryKey: ["/api/compliance/rules", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const { data: auditData } = useQuery<AuditTrailEntry[]>({
    queryKey: ["/api/audit/trail", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/compliance/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/rules", { wallet: publicKey }] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/trail", { wallet: publicKey }] });
      toast({
        title: "Rule deleted",
        description: "Compliance rule has been removed",
      });
    },
  });

  const displayRules = rules || [];
  const activeRules = displayRules.filter((r) => r.isActive).length;
  const totalActions = auditData?.length || 0;
  const alertEvents = auditData?.filter((e) => e.eventType.includes("alert") || e.eventType.includes("violation")).length || 0;

  if (!connected) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Compliance</h1>
          <p className="text-muted-foreground">
            Manage compliance rules and view audit trail
          </p>
        </div>
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-12 pb-12 text-center">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Connect Wallet</h3>
            <p className="text-muted-foreground">
              Connect your wallet to manage compliance settings
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance</h1>
          <p className="text-muted-foreground">
            Manage compliance rules and view audit trail
          </p>
        </div>
        <CreateRuleDialog />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{activeRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Audit Events</p>
                <p className="text-2xl font-bold">{totalActions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alerts</p>
                <p className="text-2xl font-bold">{alertEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <Settings className="w-4 h-4 mr-2" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <FileText className="w-4 h-4 mr-2" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Compliance Rules</h2>
            {rulesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : displayRules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Compliance Rules</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first compliance rule to automate transaction monitoring
                  </p>
                  <CreateRuleDialog />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayRules.map((rule) => (
                  <RuleCard 
                    key={rule.id} 
                    rule={rule}
                    onDelete={() => deleteMutation.mutate(rule.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                Complete record of all privacy-related actions with cryptographic proofs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTrailTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Privacy Verification
          </CardTitle>
          <CardDescription>
            All actions are cryptographically signed and verifiable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4 p-4 bg-privacy/10 rounded-lg border border-privacy/20">
            <Shield className="w-6 h-6 text-privacy mt-1" />
            <div className="space-y-2">
              <p className="font-medium">Cryptographic Audit Trail</p>
              <p className="text-sm text-muted-foreground">
                Every action in MORP OS generates a cryptographic proof that can be verified 
                without revealing the underlying transaction details. This enables compliance 
                with regulatory requirements while maintaining user privacy.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <Badge variant="outline" className="text-xs">SHA-256</Badge>
                <Badge variant="outline" className="text-xs">ZK-Ready</Badge>
                <Badge variant="outline" className="text-xs">Immutable</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
