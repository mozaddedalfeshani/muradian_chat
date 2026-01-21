import React, { useRef, useEffect, useState } from "react";
import { useAppStore, type Message } from "../../store/appStore";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { chatWithOllama } from "../../lib/ollamaChat";
import {
  chatWithOpenRouter,
  fetchOpenRouterModels,
} from "../../lib/openRouterChat";

interface ChatPaneProps {
  chatId: string | null;
  pane: "primary" | "secondary";
  isActive: boolean;
  onFocus: () => void;
}

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

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

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
      if (provider === "ollama") {
        setThinkingStatus("Thinking...");

        // System message for proper formatting
        const systemMessage = {
          role: "system",
          content:
            "When writing math equations, use $$ ... $$ for display math and $ ... $ for inline math. For example: $$E = mc^2$$ or $x^2$. Do not use [ ] brackets for math.",
        };

        // Send last 20 messages as context with system message
        const contextMessages = [systemMessage, ...updatedMessages.slice(-20)];
        let accumulatedContent = "";
        let accumulatedThinking = "";

        await chatWithOllama(
          model,
          contextMessages,
          // onChunk - for main content
          (chunk) => {
            accumulatedContent += chunk;
            setStreamingContent(accumulatedContent);
            setThinkingStatus("");
          },
          // onThinkingChunk - for thinking content
          (thinkChunk) => {
            accumulatedThinking += thinkChunk;
            setStreamingThinking(accumulatedThinking);
            setThinkingStatus("Reasoning...");
          },
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
      } else if (provider === "openrouter") {
        const apiKey = useAppStore.getState().apiKeys[provider];
        if (!apiKey) throw new Error("API Key not found");

        setThinkingStatus("Connecting to AI...");
        const contextMessages = updatedMessages.slice(-20);
        let accumulatedContent = "";

        await chatWithOpenRouter(model, apiKey, contextMessages, (chunk) => {
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
          setThinkingStatus("");
        });

        addMessage(activeChatId!, {
          role: "assistant",
          content: accumulatedContent,
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
      } else if (provider === "openrouter") {
        const apiKey = useAppStore.getState().apiKeys[provider];
        if (apiKey) {
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

      <div className="flex-1 overflow-auto p-4 space-y-4">
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
