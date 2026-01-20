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
import { useDraggable } from "@dnd-kit/core";

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
    updateChatTitle,
    updateChatConfig,
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
        title: inputValue.slice(0, 30) + (inputValue.length > 30 ? "..." : ""),
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

    // Create a temporary updated message list for context
    const updatedMessages = [
      ...(chats.find((c) => c.id === activeChatId)?.messages || []),
      userMsg,
    ];

    try {
      if (provider === "ollama") {
        // Send last 20 messages as context
        const contextMessages = updatedMessages.slice(-20);
        let accumulatedContent = "";

        await chatWithOllama(model, contextMessages, (chunk) => {
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
        });

        addMessage(activeChatId!, {
          role: "assistant",
          content: accumulatedContent,
        });
        setStreamingContent("");

        // Auto-title generation logic (simplified)
        if (updatedMessages.length < 5) {
          // ... existing title logic
          // For brevity, we can integrate the same title logic here or refactor it out
        }
      } else if (provider === "openrouter") {
        const apiKey = useAppStore.getState().apiKeys[provider];
        if (!apiKey) throw new Error("API Key not found");

        const contextMessages = updatedMessages.slice(-20);
        let accumulatedContent = "";

        await chatWithOpenRouter(model, apiKey, contextMessages, (chunk) => {
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
        });

        addMessage(activeChatId!, {
          role: "assistant",
          content: accumulatedContent,
        });
        setStreamingContent("");
      }
    } catch (error) {
      console.error("Chat error:", error);
      addMessage(activeChatId!, {
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
          title="Muradian AI"
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
          messagesEndRef={messagesEndRef}
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
