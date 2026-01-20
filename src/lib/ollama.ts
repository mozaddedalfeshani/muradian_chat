import { invoke } from "@tauri-apps/api/core";

export async function checkOllamaInstalled(): Promise<boolean> {
  try {
    // First try the Tauri command
    const isInstalled = await invoke<boolean>("check_ollama_installed");
    if (isInstalled) return true;

    // Fallback: try HTTP check
    return await checkOllamaRunning();
  } catch (error) {
    console.error("Failed to check Ollama installation:", error);
    // Final fallback: try HTTP check
    try {
      return await checkOllamaRunning();
    } catch {
      return false;
    }
  }
}

export async function getOllamaModels(): Promise<string[]> {
  try {
    const output = await invoke<string>("run_ollama_command", {
      args: ["list"],
    });
    const lines = output.trim().split("\n");
    const models = lines
      .slice(1)
      .map((line) => {
        const parts = line.split(/\s+/);
        return parts[0];
      })
      .filter(Boolean);
    return models;
  } catch (error) {
    console.error("Failed to get Ollama models:", error);
    return [];
  }
}

export async function installOllama(): Promise<boolean> {
  try {
    await invoke("install_ollama");
    return true;
  } catch (error) {
    console.error("Failed to install Ollama:", error);
    return false;
  }
}

export async function checkOllamaRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    const response = await fetch("http://localhost:11434", {
      signal: controller.signal,
    });
    clearTimeout(id);
    return response.ok || response.status === 200;
  } catch {
    return false;
  }
}

export async function pullOllamaModel(modelName: string): Promise<boolean> {
  try {
    const output = await invoke<string>("run_ollama_command", {
      args: ["pull", modelName],
    });
    // Check if pull was successful (no error in output)
    return !output.toLowerCase().includes("error");
  } catch (error) {
    console.error("Failed to pull Ollama model:", error);
    return false;
  }
}
