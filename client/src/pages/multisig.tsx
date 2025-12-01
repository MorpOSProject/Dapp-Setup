import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWalletContext } from "@/components/wallet-provider";
import { useToast } from "@/hooks/use-toast";
import { 
  Users,
  Plus,
  Shield,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Check,
  ArrowRight,
  Wallet,
  Send,
  ShieldCheck,
  Eye,
  Lock,
  Hash,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MultisigWallet, MultisigTransaction, MultisigMember } from "@shared/schema";

function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    case "approved":
      return <Badge className="gap-1 bg-blue-500/20 text-blue-500 hover:bg-blue-500/30"><ShieldCheck className="h-3 w-3" /> Approved</Badge>;
    case "executed":
      return <Badge className="gap-1 bg-green-500/20 text-green-500 hover:bg-green-500/30"><CheckCircle className="h-3 w-3" /> Executed</Badge>;
    case "rejected":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
    case "expired":
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Expired</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getTxTypeBadge(txType: string) {
  switch (txType) {
    case "transfer":
      return <Badge variant="outline" className="gap-1"><Send className="h-3 w-3" /> Transfer</Badge>;
    case "add_member":
      return <Badge variant="outline" className="gap-1"><Plus className="h-3 w-3" /> Add Member</Badge>;
    case "remove_member":
      return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Remove Member</Badge>;
    case "change_threshold":
      return <Badge variant="outline" className="gap-1"><Key className="h-3 w-3" /> Change Threshold</Badge>;
    default:
      return <Badge variant="outline">{txType}</Badge>;
  }
}

function shortenHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

async function hashPubkey(pubkey: string): Promise<string> {
  const response = await apiRequest("POST", "/api/multisig/hash-pubkey", { pubkey });
  const data = await response.json();
  return data.hash;
}

function CreateWalletCard({ onWalletCreated }: { onWalletCreated: () => void }) {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState("2");
  const [memberPubkeys, setMemberPubkeys] = useState<string[]>(["", "", ""]);
  const [isCreating, setIsCreating] = useState(false);

  const handleAddMember = () => {
    setMemberPubkeys([...memberPubkeys, ""]);
  };

  const handleRemoveMember = (index: number) => {
    if (memberPubkeys.length > 2) {
      setMemberPubkeys(memberPubkeys.filter((_, i) => i !== index));
    }
  };

  const handleMemberChange = (index: number, value: string) => {
    const newMembers = [...memberPubkeys];
    newMembers[index] = value;
    setMemberPubkeys(newMembers);
  };

  const handleCreate = async () => {
    if (!connected || !publicKey) {
      toast({ title: "Error", description: "Please connect your wallet", variant: "destructive" });
      return;
    }

    const validMembers = memberPubkeys.filter(m => m.trim() !== "");
    if (validMembers.length < 2) {
      toast({ title: "Error", description: "At least 2 members required", variant: "destructive" });
      return;
    }

    if (parseInt(threshold) > validMembers.length) {
      toast({ title: "Error", description: "Threshold cannot exceed member count", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const memberHashes = await Promise.all(
        validMembers.map(pubkey => hashPubkey(pubkey))
      );

      const response = await apiRequest("POST", "/api/multisig/wallets", {
        name,
        creatorWallet: publicKey,
        threshold: parseInt(threshold),
        totalMembers: validMembers.length,
        description: description || null,
        memberPubkeyHashes: memberHashes,
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: "Success", description: `Multi-sig wallet "${name}" created` });
        setName("");
        setDescription("");
        setThreshold("2");
        setMemberPubkeys(["", "", ""]);
        queryClient.invalidateQueries({ queryKey: ["/api/multisig/wallets"] });
        onWalletCreated();
      } else {
        throw new Error(data.error || "Failed to create wallet");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create wallet", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Multi-Sig Wallet
          </CardTitle>
          <CardDescription>Connect wallet to create a new multi-sig vault</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Connect your wallet to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create Multi-Sig Wallet
        </CardTitle>
        <CardDescription>Create a private multi-signature wallet with threshold approvals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wallet-name">Wallet Name</Label>
          <Input
            id="wallet-name"
            data-testid="input-wallet-name"
            placeholder="e.g., Team Treasury"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet-description">Description (Optional)</Label>
          <Textarea
            id="wallet-description"
            data-testid="input-wallet-description"
            placeholder="Purpose of this multi-sig wallet..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Threshold</Label>
          <Select value={threshold} onValueChange={setThreshold}>
            <SelectTrigger data-testid="select-threshold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: Math.max(memberPubkeys.filter(m => m.trim()).length, 2) }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {i + 1} of {memberPubkeys.filter(m => m.trim()).length || 3} required
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Number of signatures required to approve transactions</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Member Public Keys</Label>
            <Button size="sm" variant="ghost" onClick={handleAddMember} data-testid="button-add-member">
              <Plus className="h-4 w-4 mr-1" /> Add Member
            </Button>
          </div>
          
          {memberPubkeys.map((pubkey, index) => (
            <div key={index} className="flex gap-2">
              <Input
                data-testid={`input-member-pubkey-${index}`}
                placeholder={`Member ${index + 1} public key`}
                value={pubkey}
                onChange={(e) => handleMemberChange(index, e.target.value)}
                className="font-mono text-sm"
              />
              {memberPubkeys.length > 2 && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => handleRemoveMember(index)}
                  data-testid={`button-remove-member-${index}`}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Public keys are hashed for privacy - actual addresses not stored
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={handleCreate} 
          disabled={isCreating || !name || memberPubkeys.filter(m => m.trim()).length < 2}
          data-testid="button-create-wallet"
        >
          {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Create Multi-Sig Wallet
        </Button>
      </CardFooter>
    </Card>
  );
}

interface WalletDetailsData {
  wallet: MultisigWallet;
  members: MultisigMember[];
  transactions: MultisigTransaction[];
  pendingCount: number;
}

function WalletDetails({ walletId, onBack }: { walletId: string; onBack: () => void }) {
  const { connected, publicKey } = useWalletContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedTx, setSelectedTx] = useState<MultisigTransaction | null>(null);
  
  const [proposalType, setProposalType] = useState<string>("transfer");
  const [proposalAmount, setProposalAmount] = useState("");
  const [proposalToken, setProposalToken] = useState("SOL");
  const [proposalRecipient, setProposalRecipient] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  
  const [approvalSecret, setApprovalSecret] = useState("");

  const { data: walletDetails, isLoading } = useQuery<WalletDetailsData>({
    queryKey: ["/api/multisig/wallets", walletId],
    enabled: !!walletId,
  });

  const proposeMutation = useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error("Wallet not connected");
      
      const initiatedByHash = await hashPubkey(publicKey);
      
      const response = await apiRequest("POST", "/api/multisig/transactions", {
        walletId,
        txType: proposalType,
        tokenMint: proposalToken === "SOL" ? "So11111111111111111111111111111111111111112" : proposalToken,
        tokenSymbol: proposalToken,
        amount: proposalAmount ? parseFloat(proposalAmount) : null,
        recipientAddress: proposalRecipient || null,
        description: proposalDescription,
        initiatedByHash,
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Success", description: "Transaction proposed successfully" });
        setShowProposalDialog(false);
        setProposalType("transfer");
        setProposalAmount("");
        setProposalRecipient("");
        setProposalDescription("");
        queryClient.invalidateQueries({ queryKey: ["/api/multisig/wallets", walletId] });
      } else {
        throw new Error(data.error);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (txId: string) => {
      if (!publicKey || !approvalSecret) throw new Error("Missing credentials");
      
      const encoder = new TextEncoder();
      const data = encoder.encode(`${walletId}:${publicKey}:${approvalSecret}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const approvalCommitment = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const nullifierData = encoder.encode(`${walletId}:${publicKey}:nullifier`);
      const nullifierBuffer = await crypto.subtle.digest('SHA-256', nullifierData);
      const nullifierArray = Array.from(new Uint8Array(nullifierBuffer));
      const nullifierHash = nullifierArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const response = await apiRequest("POST", `/api/multisig/transactions/${txId}/approve`, {
        approvalCommitment,
        nullifierHash,
        membershipProof: null,
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Success", description: data.message });
        setShowApprovalDialog(false);
        setApprovalSecret("");
        setSelectedTx(null);
        queryClient.invalidateQueries({ queryKey: ["/api/multisig/wallets", walletId] });
      } else {
        throw new Error(data.error);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (txId: string) => {
      const response = await apiRequest("POST", `/api/multisig/transactions/${txId}/execute`, {
        executorWallet: publicKey,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Success", description: "Transaction executed" });
        queryClient.invalidateQueries({ queryKey: ["/api/multisig/wallets", walletId] });
      } else {
        throw new Error(data.error);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!walletDetails) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Wallet not found</p>
          <Button variant="ghost" onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { wallet, members, transactions, pendingCount } = walletDetails;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
          <ArrowRight className="h-4 w-4 rotate-180 mr-2" /> Back
        </Button>
        <h2 className="text-xl font-semibold">{wallet.name}</h2>
        <Badge variant="outline" className="gap-1">
          <Key className="h-3 w-3" />
          {wallet.threshold}/{wallet.totalMembers}
        </Badge>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {pendingCount} pending
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transactions
              </CardTitle>
              <Button size="sm" onClick={() => setShowProposalDialog(true)} data-testid="button-propose">
                <Plus className="h-4 w-4 mr-1" /> Propose
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">Propose a transaction to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Approvals</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{getTxTypeBadge(tx.txType)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tx.description}
                        {tx.amount && tx.tokenSymbol && (
                          <span className="block text-xs text-muted-foreground">
                            {tx.amount} {tx.tokenSymbol}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={tx.approvalCount >= tx.requiredApprovals ? "text-green-500" : ""}>
                            {tx.approvalCount}
                          </span>
                          <span className="text-muted-foreground">/ {tx.requiredApprovals}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-right">
                        {tx.status === "pending" && connected && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedTx(tx);
                              setShowApprovalDialog(true);
                            }}
                            data-testid={`button-approve-${tx.id}`}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        )}
                        {tx.status === "approved" && connected && (
                          <Button 
                            size="sm" 
                            onClick={() => executeMutation.mutate(tx.id)}
                            disabled={executeMutation.isPending}
                            data-testid={`button-execute-${tx.id}`}
                          >
                            {executeMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" /> Execute
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members
            </CardTitle>
            <CardDescription>{members.length} members configured</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member, index) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.nickname || `Member ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {shortenHash(member.memberPubkeyHash)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => copyHash(member.memberPubkeyHash)}
                    data-testid={`button-copy-member-${member.id}`}
                  >
                    {copiedHash === member.memberPubkeyHash ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose Transaction</DialogTitle>
            <DialogDescription>
              Create a new transaction for multi-sig approval
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={proposalType} onValueChange={setProposalType}>
                <SelectTrigger data-testid="select-proposal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="add_member">Add Member</SelectItem>
                  <SelectItem value="remove_member">Remove Member</SelectItem>
                  <SelectItem value="change_threshold">Change Threshold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {proposalType === "transfer" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      data-testid="input-proposal-amount"
                      type="number"
                      placeholder="0.00"
                      value={proposalAmount}
                      onChange={(e) => setProposalAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Token</Label>
                    <Select value={proposalToken} onValueChange={setProposalToken}>
                      <SelectTrigger data-testid="select-proposal-token">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SOL">SOL</SelectItem>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Recipient Address</Label>
                  <Input
                    data-testid="input-proposal-recipient"
                    placeholder="Recipient public key"
                    value={proposalRecipient}
                    onChange={(e) => setProposalRecipient(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                data-testid="input-proposal-description"
                placeholder="What is this transaction for?"
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProposalDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => proposeMutation.mutate()}
              disabled={proposeMutation.isPending || !proposalDescription}
              data-testid="button-submit-proposal"
            >
              {proposeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" /> Propose
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Private Approval
            </DialogTitle>
            <DialogDescription>
              Approve this transaction privately using your secret key
            </DialogDescription>
          </DialogHeader>
          
          {selectedTx && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    {getTxTypeBadge(selectedTx.txType)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Description</span>
                    <span className="text-sm">{selectedTx.description}</span>
                  </div>
                  {selectedTx.amount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Amount</span>
                      <span className="text-sm font-mono">{selectedTx.amount} {selectedTx.tokenSymbol}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Approvals</span>
                    <span className="text-sm">{selectedTx.approvalCount} / {selectedTx.requiredApprovals}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Your Secret Key
                </Label>
                <Input
                  data-testid="input-approval-secret"
                  type="password"
                  placeholder="Enter your approval secret"
                  value={approvalSecret}
                  onChange={(e) => setApprovalSecret(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Your identity is hidden using a ZK commitment scheme
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowApprovalDialog(false);
              setApprovalSecret("");
              setSelectedTx(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedTx && approveMutation.mutate(selectedTx.id)}
              disabled={approveMutation.isPending || !approvalSecret}
              data-testid="button-submit-approval"
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-1" /> Approve Privately
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WalletsList({ onSelectWallet }: { onSelectWallet: (id: string) => void }) {
  const { connected, publicKey } = useWalletContext();

  const { data: wallets, isLoading, error } = useQuery<MultisigWallet[]>({
    queryKey: ["/api/multisig/wallets", { wallet: publicKey }],
    enabled: connected && !!publicKey,
  });

  if (!connected) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Connect your wallet to view multi-sig wallets</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!wallets || wallets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No multi-sig wallets yet</p>
          <p className="text-sm text-muted-foreground">Create one to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {wallets.map((wallet) => (
        <Card 
          key={wallet.id} 
          className="hover-elevate cursor-pointer transition-colors"
          onClick={() => onSelectWallet(wallet.id)}
          data-testid={`card-wallet-${wallet.id}`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {wallet.name}
              </CardTitle>
              <Badge variant="outline" className="gap-1">
                <Key className="h-3 w-3" />
                {wallet.threshold}/{wallet.totalMembers}
              </Badge>
            </div>
            {wallet.description && (
              <CardDescription className="line-clamp-1">{wallet.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {wallet.totalMembers} members
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(wallet.createdAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MultisigPage() {
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("wallets");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Sig Wallets</h1>
          <p className="text-muted-foreground">
            Private multi-signature wallets with threshold approvals
          </p>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Privacy-First Multi-Sig</p>
              <p className="text-xs text-muted-foreground">
                Approvals are hidden using ZK commitments. Only the number of approvals is visible - 
                not who approved. Member identities are stored as hashes for maximum privacy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedWalletId ? (
        <WalletDetails 
          walletId={selectedWalletId} 
          onBack={() => setSelectedWalletId(null)} 
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="wallets" data-testid="tab-wallets">
              <Shield className="h-4 w-4 mr-2" />
              My Wallets
            </TabsTrigger>
            <TabsTrigger value="create" data-testid="tab-create">
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallets" className="space-y-4">
            <WalletsList onSelectWallet={setSelectedWalletId} />
          </TabsContent>

          <TabsContent value="create">
            <CreateWalletCard onWalletCreated={() => setActiveTab("wallets")} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
