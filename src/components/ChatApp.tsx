import React, { useState, useEffect, useRef } from "react";
import { useAppStore, type Message } from "../store/appStore";
import ProviderDialog from "./ProviderDialog";
import Sidebar from "./Sidebar";
import { chatWithOllama } from "../lib/ollamaChat";
import {
  chatWithOpenRouter,
  fetchOpenRouterModels,
} from "../lib/openRouterChat";
import { useAppStore as updateAppStore } from "../store/appStore";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import ChatInput from "./chat/ChatInput";

const ChatApp: React.FC = () => {
  const {
    hasCompletedSetup,
    provider,
    model,
    chats,
    currentChatId,
    addChat,
    addMessage,
    setModel,
  } = useAppStore();
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [openRouterModels, setOpenRouterModels] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (provider === "openrouter") {
      fetchOpenRouterModels().then(setOpenRouterModels);
    }
  }, [provider]);

  // Get current chat messages
  const currentChat = chats.find((c) => c.id === currentChatId);
  const messages = currentChat?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    // Ensure we have a valid chat session
    let activeChatId = currentChatId;
    if (!activeChatId) {
      const newChat = {
        id: Date.now().toString(),
        title: inputValue.slice(0, 30) + (inputValue.length > 30 ? "..." : ""),
        messages: [],
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

        // Auto-generate title after first few messages (using last 3 messages for context)
        const totalMessages = updatedMessages.length + 1; // +1 for the new assistant response
        if (totalMessages <= 4 && totalMessages > 1) {
          const lastMessages = [
            ...updatedMessages,
            { role: "assistant", content: accumulatedContent },
          ].slice(-3);
          const msgContext = lastMessages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");

          const titlePrompt = `Generate a short, concise title (max 3-5 words) for this chat based on the following context:\n\n${msgContext}\n\nReturn ONLY the title text, no quotes or explanations.`;

          // Generate title in background
          chatWithOllama(model, [{ role: "user", content: titlePrompt }])
            .then((title) => {
              const cleanTitle = title.trim().replace(/^["']|["']$/g, "");
              if (cleanTitle) {
                updateAppStore
                  .getState()
                  .updateChatTitle(activeChatId!, cleanTitle);
              }
            })
            .catch((err) => console.error("Failed to generate title:", err));
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
      } else {
        // Other providers (TODO: implement)
        addMessage(activeChatId!, {
          role: "assistant",
          content: `${model} integration via ${provider} coming soon!`,
        });
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {!hasCompletedSetup ? (
        <ProviderDialog open={true} />
      ) : (
        <>
          <Sidebar />

          <div className="flex-1 flex flex-col h-full relative">
            <ChatHeader />

            <MessageList
              messages={messages}
              loading={loading}
              streamingContent={streamingContent}
              messagesEndRef={messagesEndRef}
            />

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

          <ProviderDialog open={!hasCompletedSetup} />
        </>
      )}
    </div>
  );
};

export default ChatApp;
