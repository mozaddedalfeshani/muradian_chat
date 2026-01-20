import React, { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { useAppStore } from "../store/appStore";
import {
  checkOllamaInstalled,
  getOllamaModels,
  installOllama,
} from "../lib/ollama";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";

interface ProviderDialogProps {
  open: boolean;
}

const ProviderDialog: React.FC<ProviderDialogProps> = ({ open }) => {
  const { setProvider, setModel, setApiKey, completeSetup } = useAppStore();

  const [selectedProvider, setSelectedProvider] = useState("ollama");
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKeyValue] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (selectedProvider === "ollama") {
      checkStatus();
    }
  }, [selectedProvider]);

  const checkStatus = async () => {
    setLoadingModels(true);
    const installed = await checkOllamaInstalled();
    setOllamaInstalled(installed);

    if (installed) {
      const models = await getOllamaModels();
      setOllamaModels(models);
      if (models.length > 0) {
        setSelectedModel(models[0]);
      }
    }
    setLoadingModels(false);
  };

  const handleInstallOllama = async () => {
    setInstalling(true);
    setInstallProgress(10);

    const interval = setInterval(() => {
      setInstallProgress((prev) => Math.min(prev + 10, 90));
    }, 500);

    const success = await installOllama();

    clearInterval(interval);
    setInstallProgress(100);
    setInstalling(false);

    if (success) {
      checkStatus();
    }
  };

  const handleSave = () => {
    setProvider(selectedProvider);

    if (selectedProvider === "ollama") {
      setModel(selectedModel);
    } else {
      setApiKey(selectedProvider, apiKey);
      if (selectedProvider === "openrouter")
        setModel("google/gemini-2.0-flash-exp:free");
      if (selectedProvider === "openai") setModel("gpt-4o");
      if (selectedProvider === "anthropic")
        setModel("claude-3-5-sonnet-latest");
    }

    completeSetup();
  };

  const isValid = () => {
    if (selectedProvider === "ollama") return ollamaInstalled && selectedModel;
    return apiKey.length > 0;
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome to AI Chat</DialogTitle>
          <DialogDescription>
            Choose your AI provider to get started. You can change this later in
            settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={selectedProvider}
              onValueChange={setSelectedProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedProvider === "ollama" && (
            <div className="grid gap-2 p-4 border rounded-md bg-muted/50">
              {ollamaInstalled === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking
                  Ollama...
                </div>
              ) : ollamaInstalled === false ? (
                <div className="space-y-3">
                  <p className="text-sm text-amber-600 font-medium">
                    Ollama is not installed or not found.
                  </p>
                  {installing ? (
                    <div className="space-y-1">
                      <Progress value={installProgress} />
                      <p className="text-xs text-center text-muted-foreground">
                        Installing...
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleInstallOllama}
                      className="w-full inline-flex justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">
                      Install Ollama
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <Check className="h-4 w-4" /> Ollama installed
                  </div>

                  <div className="grid gap-2">
                    <Label>Model</Label>
                    {loadingModels ? (
                      <div className="text-xs text-muted-foreground">
                        Loading models...
                      </div>
                    ) : ollamaModels.length === 0 ? (
                      <div className="text-xs text-red-500">
                        No models found. Run 'ollama pull llama3' in terminal.
                      </div>
                    ) : (
                      <Select
                        value={selectedModel}
                        onValueChange={setSelectedModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {ollamaModels.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedProvider !== "ollama" && (
            <div className="grid gap-2">
              <Label htmlFor="apikey">API Key</Label>
              <input
                id="apikey"
                type="password"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={apiKey}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder={`Enter your ${selectedProvider} API key`}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={handleSave}
            disabled={!isValid()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto">
            Start Chatting
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProviderDialog;
