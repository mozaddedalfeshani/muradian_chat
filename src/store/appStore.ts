import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AppState {
  hasCompletedSetup: boolean;
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
  chats: Chat[];
  currentChatId: string | null;
  // Split View State
  layout: "single" | "split";
  activePane: "primary" | "secondary";
  primaryChatId: string | null;
  secondaryChatId: string | null;
  lastSplitState: { primaryChatId: string; secondaryChatId: string } | null;

  // Actions
  completeSetup: () => void;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setApiKey: (provider: string, key: string) => void;
  addChat: (chat: Chat) => void;
  setCurrentChatId: (id: string | null) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  updateChatConfig: (chatId: string, config: Partial<Chat["config"]>) => void;
  deleteChat: (chatId: string) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  getApiKey: (provider: string) => string;

  // Split View Actions
  enableSplitView: (chatId: string) => void;
  closeSplitView: () => void; // Keeps current primary as single
  setPaneChat: (pane: "primary" | "secondary", chatId: string) => void;
  setActivePane: (pane: "primary" | "secondary") => void;
  selectChat: (chatId: string) => void; // Smart navigation
  maximizePane: (pane: "primary" | "secondary") => void; // Close split and keep pane
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  config?: {
    provider: string;
    model: string;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // State
      hasCompletedSetup: false,
      provider: "ollama",
      model: "",
      apiKeys: {},
      chats: [],
      currentChatId: null,
      isSidebarOpen: true,

      // Split View State
      layout: "single",
      activePane: "primary",
      primaryChatId: null,
      secondaryChatId: null,
      lastSplitState: null,

      // Actions
      completeSetup: () => set({ hasCompletedSetup: true }),

      setProvider: (provider) => set({ provider }),

      setModel: (model) => set({ model }),

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      addChat: (chat) =>
        set((state) => ({
          chats: [chat, ...state.chats],
          currentChatId: chat.id,
          primaryChatId: chat.id, // Default to primary
          activePane: "primary",
        })),

      setCurrentChatId: (id) => set({ currentChatId: id, primaryChatId: id }),

      addMessage: (chatId, message) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, messages: [...chat.messages, message] }
              : chat,
          ),
        })),

      updateChatTitle: (chatId, title) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId ? { ...chat, title } : chat,
          ),
        })),

      updateChatConfig: (chatId, config) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, config: { ...chat.config, ...config } as any }
              : chat,
          ),
        })),

      deleteChat: (chatId) =>
        set((state) => {
          const newChats = state.chats.filter((chat) => chat.id !== chatId);
          const isCurrentChat = state.currentChatId === chatId;

          return {
            chats: newChats,
            currentChatId: isCurrentChat ? null : state.currentChatId,
            primaryChatId:
              state.primaryChatId === chatId ? null : state.primaryChatId,
            secondaryChatId:
              state.secondaryChatId === chatId ? null : state.secondaryChatId,
            layout: state.secondaryChatId === chatId ? "single" : state.layout, // Close split if secondary deleted
            lastSplitState:
              state.lastSplitState &&
              (state.lastSplitState.primaryChatId === chatId ||
                state.lastSplitState.secondaryChatId === chatId)
                ? null
                : state.lastSplitState,
          };
        }),

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      // Helpers
      getApiKey: (provider) => get().apiKeys[provider] || "",

      // Split View Actions
      enableSplitView: (chatId) =>
        set((state) => ({
          layout: "split",
          secondaryChatId: chatId,
          activePane: "secondary",
          lastSplitState: {
            primaryChatId: state.primaryChatId!,
            secondaryChatId: chatId,
          },
        })),

      closeSplitView: () =>
        set((state) => ({
          layout: "single",
          secondaryChatId: null,
          activePane: "primary",
          currentChatId: state.primaryChatId,
        })),

      setPaneChat: (pane, chatId) =>
        set({
          [`${pane}ChatId`]: chatId,
          currentChatId: chatId,
          activePane: pane, // Automatically focus the pane we just set
        }),

      setActivePane: (pane) =>
        set((state) => ({
          activePane: pane,
          currentChatId:
            pane === "primary" ? state.primaryChatId : state.secondaryChatId,
        })),

      selectChat: (chatId) =>
        set((state) => {
          // Verify the chat exists
          if (!state.chats.find((c) => c.id === chatId)) {
            return {};
          }

          // If in split view and clicking one of the open chats
          if (state.layout === "split") {
            if (chatId === state.primaryChatId) {
              return { activePane: "primary", currentChatId: chatId };
            }
            if (chatId === state.secondaryChatId) {
              return { activePane: "secondary", currentChatId: chatId };
            }
            // Clicking a new chat while in split view -> Switch to Single View with this chat
            // AND save the current split state
            return {
              layout: "single",
              primaryChatId: chatId,
              currentChatId: chatId,
              activePane: "primary",
              lastSplitState:
                state.primaryChatId && state.secondaryChatId
                  ? {
                      primaryChatId: state.primaryChatId,
                      secondaryChatId: state.secondaryChatId,
                    }
                  : state.lastSplitState,
            };
          } else {
            // In Single View
            // Check if this chat was part of a stored split state
            if (state.lastSplitState) {
              const { primaryChatId, secondaryChatId } = state.lastSplitState;

              // Verify BOTH chats in the split state still exist
              const primaryExists = state.chats.find(
                (c) => c.id === primaryChatId,
              );
              const secondaryExists = state.chats.find(
                (c) => c.id === secondaryChatId,
              );

              if (
                primaryExists &&
                secondaryExists &&
                (chatId === primaryChatId || chatId === secondaryChatId)
              ) {
                // RESTORE SPLIT VIEW
                return {
                  layout: "split",
                  primaryChatId,
                  secondaryChatId,
                  activePane:
                    chatId === primaryChatId ? "primary" : "secondary",
                  currentChatId: chatId,
                };
              } else if (
                (!primaryExists || !secondaryExists) &&
                (chatId === primaryChatId || chatId === secondaryChatId)
              ) {
                // If one of them is missing, clear the invalid state and proceed to standard switch
                // But wait, we can't return logic here easily to modify state.lastSplitState AND proper return.
                // We just fall through to standard switch, effectively ignoring the broken split state.
                // Ideally we should clear it, but we can't side-effect easily in this pattern without complex object text.
                // Implicitly, the next state update sets fields. 'lastSplitState' remains stale?
                // No, let's clear it in the return object.
                // We will return standard switch WITH lastSplitState: null.
                return {
                  primaryChatId: chatId,
                  currentChatId: chatId,
                  activePane: "primary",
                  lastSplitState: null,
                };
              }
            }

            // Standard switch in single view
            return {
              primaryChatId: chatId,
              currentChatId: chatId,
              activePane: "primary",
            };
          }
        }),

      maximizePane: (pane) =>
        set((state) => ({
          layout: "single",
          primaryChatId:
            pane === "primary" ? state.primaryChatId : state.secondaryChatId,
          currentChatId:
            pane === "primary" ? state.primaryChatId : state.secondaryChatId,
          activePane: "primary",
          lastSplitState:
            state.primaryChatId && state.secondaryChatId
              ? {
                  primaryChatId: state.primaryChatId,
                  secondaryChatId: state.secondaryChatId,
                }
              : null,
        })),
    }),
    {
      name: "chat-app-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export type { Chat, Message, AppState };
