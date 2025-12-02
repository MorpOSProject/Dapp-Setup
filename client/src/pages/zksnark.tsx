import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Code2,
  Play,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Zap,
  Shield,
  FileCode,
  Terminal,
  Clock,
  Hash,
  Key,
  Lock,
  Loader2,
  Sparkles,
  Binary,
  GitBranch,
  AlertCircle,
} from "lucide-react";

interface CircuitTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  constraintCount: number;
  publicInputCount: number;
  privateInputCount: number;
  inputExample: Record<string, any>;
  sourceCode?: string;
}

interface GeneratedProof {
  id: string;
  circuitId: string;
  isTemplate: boolean;
  publicInputs: Record<string, any>;
  proofData: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
  };
  publicSignals: string[];
  verified: boolean;
  generationTimeMs: number;
  verificationTimeMs: number;
  status: string;
  createdAt: string;
}

export default function ZkSnarkPage() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toString() || "";
  const { toast } = useToast();
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [generatedProof, setGeneratedProof] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<CircuitTemplate[]>({
    queryKey: ["/api/zksnark/templates"],
  });

  const { data: templateDetails } = useQuery<CircuitTemplate>({
    queryKey: ["/api/zksnark/templates", selectedTemplate],
    enabled: !!selectedTemplate,
  });

  const { data: proofs = [], isLoading: proofsLoading } = useQuery<GeneratedProof[]>({
    queryKey: ["/api/zksnark/proofs", walletAddress],
    enabled: !!walletAddress,
  });

  const generateProofMutation = useMutation({
    mutationFn: async (data: { templateId: string; inputs: Record<string, any> }) => {
      const response = await apiRequest("POST", "/api/zksnark/generate-proof", {
        walletAddress,
        templateId: data.templateId,
        inputs: data.inputs,
        isTemplate: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedProof(data);
      setVerificationResult(null);
      if (walletAddress) {
        queryClient.invalidateQueries({ queryKey: ["/api/zksnark/proofs", walletAddress] });
      }
      toast({
        title: "Proof Generated",
        description: `Generated in ${data.generationTimeMs}ms`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyProofMutation = useMutation({
    mutationFn: async (data: { proof: any; publicSignals: string[]; templateId: string }) => {
      const response = await apiRequest("POST", "/api/zksnark/verify-proof", {
        proofId: generatedProof?.proofId,
        templateId: data.templateId,
        proof: data.proof,
        publicSignals: data.publicSignals,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setVerificationResult(data.verified);
      if (walletAddress) {
        queryClient.invalidateQueries({ queryKey: ["/api/zksnark/proofs", walletAddress] });
      }
      toast({
        title: data.verified ? "Proof Verified" : "Verification Failed",
        description: `Verified in ${data.verificationTimeMs}ms`,
        variant: data.verified ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setGeneratedProof(null);
    setVerificationResult(null);
    const template = templates.find((t) => t.id === templateId);
    if (template?.inputExample) {
      const inputs: Record<string, string> = {};
      Object.entries(template.inputExample).forEach(([key, value]) => {
        inputs[key] = Array.isArray(value) ? JSON.stringify(value) : String(value);
      });
      setInputValues(inputs);
    }
  };

  const handleGenerateProof = () => {
    if (!selectedTemplate) return;
    
    const parsedInputs: Record<string, any> = {};
    Object.entries(inputValues).forEach(([key, value]) => {
      try {
        parsedInputs[key] = JSON.parse(value);
      } catch {
        parsedInputs[key] = isNaN(Number(value)) ? value : Number(value);
      }
    });
    
    generateProofMutation.mutate({
      templateId: selectedTemplate,
      inputs: parsedInputs,
    });
  };

  const handleVerifyProof = () => {
    if (!generatedProof?.proof || !generatedProof?.publicSignals) return;
    
    verifyProofMutation.mutate({
      proof: generatedProof.proof,
      publicSignals: generatedProof.publicSignals,
      templateId: selectedTemplate,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "privacy":
        return "bg-purple-500/10 text-purple-500 border-purple-500/30";
      case "identity":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "compliance":
        return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      case "defi":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!walletAddress) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Wallet Not Connected</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Please connect your wallet to access zkSNARK Dev Tools.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
              <Code2 className="h-6 w-6 text-primary" />
            </div>
            zkSNARK Dev Tools
          </h1>
          <p className="text-muted-foreground">
            Build and test zero-knowledge proofs using Circom circuits and snarkjs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            Groth16
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            PLONK
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="templates" className="gap-2" data-testid="tab-templates">
            <FileCode className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="playground" className="gap-2" data-testid="tab-playground">
            <Terminal className="h-4 w-4" />
            Playground
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templatesLoading ? (
              Array(6).fill(0).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 w-32 bg-muted rounded" />
                    <div className="h-4 w-48 bg-muted rounded mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : (
              templates.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selectedTemplate === template.id ? "border-primary ring-1 ring-primary/20" : ""
                  }`}
                  onClick={() => handleTemplateSelect(template.id)}
                  data-testid={`template-${template.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="outline" className={getCategoryColor(template.category)}>
                        {template.category}
                      </Badge>
                    </div>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted">
                        <Binary className="h-3 w-3" />
                        <span>{template.constraintCount} constraints</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted">
                        <Key className="h-3 w-3" />
                        <span>{template.publicInputCount} public</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted">
                        <Lock className="h-3 w-3" />
                        <span>{template.privateInputCount} private</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="playground" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  Circuit Source
                </CardTitle>
                <CardDescription>
                  {selectedTemplate
                    ? `Viewing: ${templates.find((t) => t.id === selectedTemplate)?.name || selectedTemplate}`
                    : "Select a template to view its source code"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templateDetails?.sourceCode ? (
                  <div className="relative">
                    <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
                      <pre className="text-sm font-mono whitespace-pre-wrap">
                        {templateDetails.sourceCode}
                      </pre>
                    </ScrollArea>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() =>
                        copyToClipboard(templateDetails.sourceCode!, "Source code")
                      }
                      data-testid="button-copy-source"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                    <Code2 className="h-12 w-12 mb-4" />
                    <p>Select a template to view source</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Input Parameters
                </CardTitle>
                <CardDescription>
                  Configure inputs for proof generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTemplate && templateDetails?.inputExample ? (
                  <>
                    {Object.entries(templateDetails.inputExample).map(([key, defaultValue]) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={key} className="flex items-center gap-2">
                          {key}
                          {templateDetails.publicInputCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {Array.isArray(defaultValue) ? "array" : typeof defaultValue}
                            </Badge>
                          )}
                        </Label>
                        <Input
                          id={key}
                          value={inputValues[key] || ""}
                          onChange={(e) =>
                            setInputValues((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${key}`}
                          data-testid={`input-${key}`}
                        />
                      </div>
                    ))}
                    <Separator className="my-4" />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleGenerateProof}
                        disabled={generateProofMutation.isPending}
                        className="flex-1 gap-2"
                        data-testid="button-generate-proof"
                      >
                        {generateProofMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Generate Proof
                      </Button>
                      <Button
                        onClick={handleVerifyProof}
                        variant="outline"
                        disabled={!generatedProof || verifyProofMutation.isPending}
                        className="gap-2"
                        data-testid="button-verify-proof"
                      >
                        {verifyProofMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Verify
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <GitBranch className="h-12 w-12 mb-4" />
                    <p>Select a template to configure inputs</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {generatedProof && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    Generated Proof
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {verificationResult !== null && (
                      <Badge
                        variant="outline"
                        className={
                          verificationResult
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-destructive/10 text-destructive border-destructive/30"
                        }
                      >
                        {verificationResult ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Invalid
                          </>
                        )}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {generatedProof.generationTimeMs}ms
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Proof (pi_a, pi_b, pi_c)</Label>
                    <ScrollArea className="h-[200px] rounded-lg border bg-muted/30 p-3">
                      <pre className="text-xs font-mono">
                        {JSON.stringify(generatedProof.proof, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Public Signals</Label>
                    <ScrollArea className="h-[200px] rounded-lg border bg-muted/30 p-3">
                      <pre className="text-xs font-mono">
                        {JSON.stringify(generatedProof.publicSignals, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(generatedProof, null, 2), "Proof data")
                    }
                    data-testid="button-copy-proof"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(generatedProof, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "proof.json";
                      a.click();
                    }}
                    data-testid="button-download-proof"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Proof History
              </CardTitle>
              <CardDescription>
                Previously generated proofs and their verification status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {proofsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : proofs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Hash className="h-12 w-12 mb-4" />
                  <p>No proofs generated yet</p>
                  <p className="text-sm">Generate your first proof in the Playground tab</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {proofs.map((proof) => (
                      <div
                        key={proof.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        data-testid={`proof-${proof.id}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {proof.isTemplate ? proof.circuitId : "Custom Circuit"}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                proof.status === "verified"
                                  ? "bg-success/10 text-success border-success/30"
                                  : proof.status === "generated"
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-muted"
                              }
                            >
                              {proof.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Generated: {new Date(proof.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {proof.generationTimeMs || 0}ms
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(JSON.stringify(proof.proofData, null, 2), "Proof")
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
