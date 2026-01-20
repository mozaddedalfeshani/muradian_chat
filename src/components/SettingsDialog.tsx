import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useAppStore } from "../store/appStore";
import {
  checkOllamaInstalled,
  getOllamaModels,
  checkOllamaRunning,
  pullOllamaModel,
} from "../lib/ollama";
import {
  Settings as SettingsIcon,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Button } from "./ui/button";

const DEFAULT_MODEL = "deepseek-r1:1.5b";

const SettingsDialog: React.FC = () => {
  const { provider, model, apiKeys, setProvider, setModel, setApiKey } =
    useAppStore();

  const [localProvider, setLocalProvider] = useState(provider);
  const [localModel, setLocalModel] = useState(model);
  const [localApiKey, setLocalApiKey] = useState("");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pullingModel, setPullingModel] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setLocalProvider(provider);
      setLocalModel(model);
      setLocalApiKey(apiKeys[provider] || "");

      if (provider === "ollama" || localProvider === "ollama") {
        loadOllamaModels();
      }
    }
  }, [open, provider, model, apiKeys]);

  useEffect(() => {
    if (localProvider === "ollama") {
      loadOllamaModels();
    } else {
      setLocalApiKey(apiKeys[localProvider] || "");
      setOllamaError(null);
    }
  }, [localProvider, apiKeys]);

  const loadOllamaModels = async () => {
    setIsLoadingModels(true);
    setOllamaError(null);

    try {
      const isRunning = await checkOllamaRunning();
      if (!isRunning) {
        setOllamaError("Ollama is not running. Please start Ollama first.");
        setOllamaModels([]);
        setIsLoadingModels(false);
        return;
      }

      const installed = await checkOllamaInstalled();
      if (!installed) {
        setOllamaError("Ollama is not installed.");
        setOllamaModels([]);
        setIsLoadingModels(false);
        return;
      }

      const models = await getOllamaModels();
      setOllamaModels(models);

      if (models.length === 0) {
        setOllamaError(
          "No models found. Run 'ollama pull <model>' to download a model.",
        );
      } else if (!models.includes(localModel)) {
        setLocalModel(models[0]);
      }
    } catch (error) {
      setOllamaError("Failed to load models. Check if Ollama is running.");
      setOllamaModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handlePullDefaultModel = async () => {
    setPullingModel(true);
    setPullProgress(10);
    setOllamaError(null);

    const interval = setInterval(() => {
      setPullProgress((prev) => Math.min(prev + 5, 90));
    }, 1000);

    const success = await pullOllamaModel(DEFAULT_MODEL);

    clearInterval(interval);
    setPullProgress(100);

    if (success) {
      const models = await getOllamaModels();
      setOllamaModels(models);
      if (models.length > 0) {
        setLocalModel(
          models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0],
        );
      }
    } else {
      setOllamaError("Failed to download model. Please try again.");
    }

    setPullingModel(false);
  };

  const handleSave = () => {
    setProvider(localProvider);
    if (localProvider === "ollama") {
      setModel(localModel);
    } else {
      setApiKey(localProvider, localApiKey);
      if (localProvider === "openrouter")
        setModel("google/gemini-2.0-flash-exp:free");
      if (localProvider === "openai") setModel("gpt-4o");
    }
    setOpen(false);
  };

  const handleResetConfirm = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>
          <div className="flex items-center justify-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 w-full">
            <SettingsIcon className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider-settings">Provider</Label>
              <Select value={localProvider} onValueChange={setLocalProvider}>
                <SelectTrigger id="provider-settings">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ollama">Ollama</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {localProvider === "ollama" && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Model</Label>
                  {isLoadingModels && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {ollamaError ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{ollamaError}</span>
                    </div>
                    {ollamaError.includes("No models") && !pullingModel && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Would you like to download{" "}
                          <strong>{DEFAULT_MODEL}</strong>?
                        </p>
                        <Button
                          onClick={handlePullDefaultModel}
                          variant="outline"
                          className="w-full">
                          <Download className="h-4 w-4 mr-2" />
                          Download {DEFAULT_MODEL}
                        </Button>
                      </div>
                    )}
                    {pullingModel && (
                      <div className="space-y-1">
                        <Progress value={pullProgress} />
                        <p className="text-xs text-center text-muted-foreground">
                          Downloading {DEFAULT_MODEL}... This may take a few
                          minutes.
                        </p>
                      </div>
                    )}
                  </div>
                ) : ollamaModels.length > 0 ? (
                  <Select value={localModel} onValueChange={setLocalModel}>
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
                ) : (
                  <div className="text-sm text-muted-foreground p-2">
                    {isLoadingModels
                      ? "Loading models..."
                      : "No models available"}
                  </div>
                )}

                <button
                  onClick={loadOllamaModels}
                  disabled={isLoadingModels}
                  className="text-xs text-primary hover:underline text-left disabled:opacity-50">
                  {isLoadingModels ? "Refreshing..." : "Refresh models"}
                </button>
              </div>
            )}

            {localProvider !== "ollama" && (
              <div className="grid gap-2">
                <Label htmlFor="apikey-settings">API Key</Label>
                <input
                  id="apikey-settings"
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex w-full gap-2 flex-col sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(true)}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                Reset Settings
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reset All Settings?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will clear all your settings, chat history, and API keys. The
              app will reload and you'll need to set up everything again.
            </p>
            <p className="text-sm text-destructive font-medium mt-2">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <div className="flex w-full gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleResetConfirm}>
                Yes, Reset Everything
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SettingsDialog;
