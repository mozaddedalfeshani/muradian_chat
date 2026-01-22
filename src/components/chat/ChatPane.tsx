import React, { useRef, useEffect, useState } from "react";
import { useAppStore, type Message } from "../../store/appStore";
import { invoke } from "@tauri-apps/api/core";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { chatWithOllama } from "../../lib/ollamaChat";
import { checkOllamaRunning, getOllamaModels } from "../../lib/ollama";
import {
  chatWithOpenRouter,
  fetchOpenRouterModels,
} from "../../lib/openRouterChat";
import { OPENROUTER_API_KEY } from "../../secret/api";

interface ChatPaneProps {
  chatId: string | null;
  pane: "primary" | "secondary";
  isActive: boolean;
  onFocus: () => void;
}

const FREE_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.0-pro-exp-02-05:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "mistralai/mistral-small-24b-instruct-2501:free",
];

const ChatPane: React.FC<ChatPaneProps> = ({
  chatId,
  pane,
  isActive,
  onFocus,
}) => {
  const {
    chats,
    addChat,
    addMessage,
    editMessage,
    deleteMessagesAfter,
    updateChatConfig,
    updateChatTitle,
    provider: globalProvider,
    model: globalModel,
    layout,
    maximizePane,
  } = useAppStore();

  const currentChat = chats.find((c) => c.id === chatId);
  const messages = currentChat?.messages || [];

  // Local state for input
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThinking, setStreamingThinking] = useState("");
  const [thinkingStatus, setThinkingStatus] = useState("");
  const [openRouterModels, setOpenRouterModels] = useState<string[]>([]);
  const [setupProgress, setSetupProgress] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine provider/model for this pane
  // If specific chat config exists, use it. Otherwise use global.
  const provider = currentChat?.config?.provider || globalProvider;
  const model = currentChat?.config?.model || globalModel;

  const setModel = (newModel: string) => {
    if (chatId) {
      updateChatConfig(chatId, { model: newModel });
    } else {
      // Update global model when no chat is selected
      useAppStore.getState().setModel(newModel);
    }
  };

  useEffect(() => {
    if (provider === "openrouter") {
      fetchOpenRouterModels().then(setOpenRouterModels);
    }
  }, [provider]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check and setup Muradian Auto dependencies
  useEffect(() => {
    if (provider === "muradian") {
      const checkAndSetup = async () => {
        try {
          const models = await getOllamaModels();
          const hasDeepSeek = models.includes("deepseek-r1:1.5b");

          if (!hasDeepSeek) {
            setSetupProgress(
              "We are setting up your models, it depends on your internet speed",
            );
            await invoke("setup_muradian_auto");
            setSetupProgress(null);
          }
        } catch (e) {
          console.error("Setup check failed", e);
          // Maybe setup failed or ollama not running at all.
          // If completely not running, setup_muradian_auto might fix it (install).
          // But we need to invoke it.
          try {
            setSetupProgress(
              "We are setting up your models, it depends on your internet speed",
            );
            await invoke("setup_muradian_auto");
            setSetupProgress(null);
          } catch (err) {
            setSetupProgress("Setup Failed. Please install Ollama manually.");
            setTimeout(() => setSetupProgress(null), 5000);
          }
        }
      };
      checkAndSetup();
    }
  }, [provider]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const detectIntent = async (
    msgs: Message[],
  ): Promise<"CODING" | "GENERAL"> => {
    try {
      setThinkingStatus("Muradian Auto: Detecting intent...");
      const context = msgs
        .slice(-10)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      let intent = "";
      await chatWithOllama(
        "deepseek-r1:1.5b",
        [
          {
            role: "user",
            content: `Analyze the following conversation context and determine if the user is asking for code, programming help, or technical implementation details. 
          
Context:
${context}

Respond with ONLY one word: "CODING" or "GENERAL". Do not explain.`,
          },
        ],
        (chunk) => {
          intent += chunk;
        },
      );

      const cleanIntent = intent.trim().toUpperCase();
      return cleanIntent.includes("CODING") ? "CODING" : "GENERAL";
    } catch (e) {
      console.warn("Intent detection failed, defaulting to GENERAL", e);
      return "GENERAL";
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setThinkingStatus("");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    // Determine active Chat ID
    let activeChatId = chatId;
    if (!activeChatId) {
      // If this is the primary pane and empty, create a new chat
      const newChat = {
        id: Date.now().toString(),
        title: "New Chat",
        messages: [],
        config: { provider, model },
      };
      addChat(newChat);
      activeChatId = newChat.id;
    }

    // Create new abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Cancel previous if any
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const userMsg: Message = { role: "user", content: inputValue };
    addMessage(activeChatId!, userMsg);
    setInputValue("");
    setLoading(true);
    setStreamingContent("");
    setStreamingThinking("");
    setThinkingStatus("Understanding your message...");

    // Create a temporary updated message list for context
    const updatedMessages = [
      ...(chats.find((c) => c.id === activeChatId)?.messages || []),
      userMsg,
    ];

    try {
      let activeProvider = provider;
      let activeModel = model;

      // Muradian Auto Logic
      if (provider === "muradian") {
        try {
          // Check for local model availability
          const isLocalAvailable = await checkOllamaRunning();
          // Switch to cloud after 5 messages, OR if intent detection requires it
          const messageCount = updatedMessages.length;
          const isCheckpoint =
            messageCount === 2 || (messageCount >= 4 && messageCount % 4 === 0);

          let detectedIntent = "GENERAL";

          if (isLocalAvailable && isCheckpoint) {
            const localModels = await getOllamaModels();
            if (localModels.length > 0) {
              detectedIntent = await detectIntent(updatedMessages);
            }
          }

          if (detectedIntent === "CODING") {
            setThinkingStatus("Muradian Auto: Switching to Coding Mode...");
            activeProvider = "openrouter";
            activeModel = "qwen/qwen-2.5-coder-32b-instruct:free";
          } else {
            // Standard Logic fallback
            const shouldTryLocal = isLocalAvailable && messageCount <= 5;

            if (shouldTryLocal) {
              activeProvider = "ollama";
              // Attempt to get a valid local model
              const localModels = await getOllamaModels();
              if (localModels.length > 0) {
                // Prefer deepseek-r1:1.5b as default if available
                activeModel = localModels.includes("deepseek-r1:1.5b")
                  ? "deepseek-r1:1.5b"
                  : localModels[0];
              } else {
                activeModel = "deepseek-r1:1.5b";
              }
            } else {
              activeProvider = "openrouter";
              // If user has set a key for a specific provider, we might want to respect that?
              // But for "Muradian Auto" we force specific free models.
              activeModel = "google/gemini-2.0-flash-exp:free";
            }
          }
        } catch (e) {
          console.error("Muradian Auto logic error:", e);
          // Fallback to openrouter
          activeProvider = "openrouter";
          activeModel = "google/gemini-2.0-flash-exp:free";
        }
      }

      if (activeProvider === "ollama") {
        setThinkingStatus("Thinking...");

        // System message for proper formatting
        const systemMessage = {
          role: "system" as const, // Fix TS issue with string vs literal
          content:
            "You are a helpful assistant Simple and. Usage: Use note : if math ? then use $$ ... $$ for display math and $ ... $ for inline math. Use note : if math ? then use $$ ... $$ for display math and $ ... $ for inline math.",
        };

        // Send last 20 messages as context with system message
        const contextMessages = [systemMessage, ...updatedMessages.slice(-20)];
        let accumulatedContent = "";
        let accumulatedThinking = "";

        await chatWithOllama(
          activeModel,
          contextMessages,
          // onChunk - for main content
          (chunk) => {
            accumulatedContent += chunk;
            setStreamingContent(accumulatedContent);
            setThinkingStatus("");
          },
          (thinkChunk) => {
            accumulatedThinking += thinkChunk;
            setStreamingThinking(accumulatedThinking);
            setThinkingStatus("Reasoning...");
          },
          signal,
        );

        addMessage(activeChatId!, {
          role: "assistant",
          content: accumulatedContent,
          thinking: accumulatedThinking || undefined,
        });
        setStreamingContent("");
        setStreamingThinking("");

        // Auto-title generation after 4 messages
        const currentMessages = [
          ...updatedMessages,
          { role: "assistant" as const, content: accumulatedContent },
        ];
        if (currentMessages.length === 4) {
          generateTitle(activeChatId!, currentMessages);
        }
      } else if (activeProvider === "openrouter") {
        let apiKey = useAppStore.getState().getApiKey("openrouter");

        // Direct fallback check
        if (!apiKey) {
          apiKey = OPENROUTER_API_KEY || "";
        }

        if (!apiKey || apiKey.includes("YOUR_KEY_HERE")) {
          throw new Error(
            "API Key not found or invalid. Please update 'src/secret/api.ts' with your OpenRouter API key.",
          );
        }

        setThinkingStatus("Connecting to AI...");
        const contextMessages = updatedMessages.slice(-20);
        let accumulatedContent = "";

        if (provider === "muradian") {
          const modelsToTry = Array.from(
            new Set([activeModel, ...FREE_MODELS]),
          );
          let lastError;
          let success = false;

          for (const modelToTry of modelsToTry) {
            try {
              setThinkingStatus("Muradian Model Is processing");

              accumulatedContent = ""; // Reset for new attempt
              await chatWithOpenRouter(
                modelToTry,
                apiKey,
                contextMessages,
                (chunk) => {
                  accumulatedContent += chunk;
                  setStreamingContent(accumulatedContent);
                  setThinkingStatus("");
                },
                signal,
              );
              success = true;
              // Persist which model succeeded
              activeModel = modelToTry;
              break;
            } catch (e) {
              console.warn(`Muradian Auto: Model ${modelToTry} failed`, e);
              lastError = e;
              // Continue to next model
            }
          }

          if (!success) throw lastError;
        } else {
          // Standard direct use
          await chatWithOpenRouter(
            activeModel,
            apiKey,
            contextMessages,
            (chunk) => {
              accumulatedContent += chunk;
              setStreamingContent(accumulatedContent);
              setThinkingStatus("");
            },
            signal,
          );
        }

        addMessage(activeChatId!, {
          role: "assistant",
          content: accumulatedContent,
          model: activeModel, // Save model attribution
        });
        setStreamingContent("");

        // Auto-title generation after 4 messages
        const currentMessages = [
          ...updatedMessages,
          { role: "assistant" as const, content: accumulatedContent },
        ];
        if (currentMessages.length === 4) {
          generateTitle(activeChatId!, currentMessages);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      addMessage(activeChatId!, {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
      });
    } finally {
      setLoading(false);
      setThinkingStatus("");
    }
  };

  // Generate title from first 4 messages
  const generateTitle = async (chatId: string, msgs: Message[]) => {
    try {
      const titlePrompt = `Based on this conversation, generate a very short title (max 5 words). Only respond with the title, nothing else:\n\n${msgs.map((m) => `${m.role}: ${m.content.slice(0, 100)}`).join("\n")}`;

      let title = "";
      if (provider === "ollama") {
        await chatWithOllama(
          model,
          [{ role: "user", content: titlePrompt }],
          (chunk) => {
            title += chunk;
          },
        );
      } else if (provider === "openrouter" || provider === "muradian") {
        let apiKey = useAppStore.getState().getApiKey("openrouter");
        if (!apiKey) {
          apiKey = OPENROUTER_API_KEY || "";
        }

        if (!apiKey || apiKey.includes("YOUR_KEY_HERE")) {
          console.error("No valid API key for title generation");
          return;
        }

        if (provider === "muradian") {
          const modelsToTry = Array.from(
            new Set(["google/gemini-2.0-flash-exp:free", ...FREE_MODELS]),
          );
          let success = false;

          for (const modelToTry of modelsToTry) {
            try {
              title = ""; // Reset for new attempt
              await chatWithOpenRouter(
                modelToTry,
                apiKey,
                [{ role: "user", content: titlePrompt }],
                (chunk) => {
                  title += chunk;
                },
              );
              if (title.trim()) {
                success = true;
                break;
              }
            } catch (e) {
              console.warn(
                `Muradian Auto Title: Model ${modelToTry} failed`,
                e,
              );
            }
          }
          if (!success) return;
        } else {
          // Standard openrouter provider
          await chatWithOpenRouter(
            model,
            apiKey,
            [{ role: "user", content: titlePrompt }],
            (chunk) => {
              title += chunk;
            },
          );
        }
      }

      // Clean up the title
      title = title
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/^[Tt]itle:\s*/, "") // Remove common prefixes
        .slice(0, 50);

      if (title) {
        updateChatTitle(chatId, title);
      }
    } catch (error) {
      console.error("Failed to generate title:", error);
    }
  };

  const handleRegenerateFromPoint = async (
    index: number,
    newContent: string,
  ) => {
    if (!chatId || loading) return;

    // 1. Edit the message at the index
    editMessage(chatId, index, newContent);

    // 2. Delete all messages after this index
    deleteMessagesAfter(chatId, index);

    // 3. Resend to AI with the updated context
    setLoading(true);
    setStreamingContent("");

    // Get the updated messages (up to and including the edited message)
    const updatedMessages =
      chats
        .find((c) => c.id === chatId)
        ?.messages.slice(0, index + 1)
        .map((msg, idx) =>
          idx === index ? { ...msg, content: newContent } : msg,
        ) || [];

    try {
      if (provider === "ollama") {
        const contextMessages = updatedMessages.slice(-20);
        let accumulatedContent = "";

        await chatWithOllama(model, contextMessages, (chunk) => {
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
        });

        addMessage(chatId, {
          role: "assistant",
          content: accumulatedContent,
        });
        setStreamingContent("");
      } else if (provider === "openrouter") {
        const apiKey = useAppStore.getState().apiKeys[provider];
        if (!apiKey) throw new Error("API Key not found");

        const contextMessages = updatedMessages.slice(-20);
        let accumulatedContent = "";

        await chatWithOpenRouter(model, apiKey, contextMessages, (chunk) => {
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
        });

        addMessage(chatId, {
          role: "assistant",
          content: accumulatedContent,
        });
        setStreamingContent("");
      }
    } catch (error) {
      console.error("Chat error:", error);
      addMessage(chatId, {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Draggable attributes for the header to allow docking/undocking or moving
  // For now, we just make the whole pane focusable

  // If no chat is selected, show empty state
  if (!chatId && messages.length === 0) {
    return (
      <div
        className={`flex-1 flex flex-col h-full relative border-l ${isActive ? "ring-2 ring-primary/10" : ""}`}
        onClick={onFocus}>
        <ChatHeader
          title="MOSP Chat"
          provider={provider}
          model={model}
          onMaximize={layout === "split" ? () => maximizePane(pane) : undefined}
        />

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <span className="text-4xl mb-4">💬</span>
            <p>Start a conversation...</p>
          </div>
        </div>

        <ChatInput
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleSend={handleSend}
          loading={loading}
          provider={provider}
          model={model}
          models={openRouterModels}
          setModel={setModel}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex-1 flex flex-col h-full relative border-l ${isActive ? "ring-2 ring-primary/10" : ""}`}
      onClick={onFocus}>
      <ChatHeader
        title={currentChat?.title}
        provider={provider}
        model={model}
        onMaximize={layout === "split" ? () => maximizePane(pane) : undefined}
      />

      <div className="flex-1 overflow-auto p-4 space-y-4 relative">
        {setupProgress && (
          <div className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-2 mb-2 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span className="text-sm font-medium text-primary">
              {setupProgress}
            </span>
          </div>
        )}
        <MessageList
          messages={messages}
          loading={loading}
          streamingContent={streamingContent}
          streamingThinking={streamingThinking}
          thinkingStatus={thinkingStatus}
          messagesEndRef={messagesEndRef}
          onRegenerateFromPoint={handleRegenerateFromPoint}
          onAskThis={(text) => setInputValue(text)}
        />
      </div>

      <ChatInput
        inputValue={inputValue}
        setInputValue={setInputValue}
        handleSend={handleSend}
        handleStop={handleStop}
        loading={loading}
        provider={provider}
        model={model}
        models={openRouterModels}
        setModel={setModel}
      />
    </div>
  );
};

export default ChatPane;
