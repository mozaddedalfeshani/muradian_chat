import React from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
} from "lucide-react";
import SettingsDialog from "./SettingsDialog";
import { useAppStore, type Chat } from "../store/appStore";
import { useTheme } from "next-themes";
import { useDraggable } from "@dnd-kit/core";
import { Button } from "./ui/button";

const Sidebar: React.FC = () => {
  const {
    chats,
    addChat,
    currentChatId,
    selectChat,
    deleteChat,
    isSidebarOpen,
    toggleSidebar,
    closeSplitView,
  } = useAppStore();
  const { theme, setTheme } = useTheme();

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
    };
    addChat(newChat);
  };

  return (
    <div
      className={`${
        isSidebarOpen ? "w-72" : "w-[90px]"
      } bg-muted/30 backdrop-blur-xl flex flex-col h-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-20`}>
      <div className="p-4">
        <Button
          onClick={handleNewChat}
          className={`w-full flex items-center gap-2 justify-center bg-primary/90 hover:bg-primary text-primary-foreground shadow-lg transition-all duration-300 rounded-xl py-6 ${
            !isSidebarOpen && "px-0 w-12 h-12 mx-auto"
          }`}
          title="New Chat">
          <Plus className="h-5 w-5" />
          {isSidebarOpen && (
            <span className="text-base font-semibold">New Chat</span>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {chats.map((chat) => (
          <DraggableChatItem
            key={chat.id}
            chat={chat}
            isActive={currentChatId === chat.id}
            isSidebarOpen={isSidebarOpen}
            onSelect={() => selectChat(chat.id)}
            onDelete={() => deleteChat(chat.id)}
            onCloseSplit={closeSplitView}
          />
        ))}
      </div>

      <div className="p-4 border-t flex flex-col gap-2">
        <div
          className={`flex items-center gap-2 justify-between ${!isSidebarOpen && "flex-col gap-4"}`}>
          <div
            className={`${!isSidebarOpen ? "w-full flex justify-center" : "flex-1"}`}>
            <SettingsDialog />
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200 hover:shadow-sm ring-1 ring-transparent hover:ring-border/50"
            title="Toggle Theme">
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={toggleSidebar}
            className="p-2.5 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200 hover:shadow-sm ring-1 ring-transparent hover:ring-border/50"
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}>
            {isSidebarOpen ? (
              <ChevronsLeft className="h-5 w-5" />
            ) : (
              <ChevronsRight className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DraggableChatItemProps {
  chat: Chat;
  isActive: boolean;
  isSidebarOpen: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onCloseSplit: () => void;
}

const DraggableChatItem: React.FC<DraggableChatItemProps> = ({
  chat,
  isActive,
  isSidebarOpen,
  onSelect,
  onDelete,
  onCloseSplit,
}) => {
  const { layout, primaryChatId, secondaryChatId } = useAppStore();

  // Check if this chat is in split view
  const isInSplit =
    layout === "split" &&
    (chat.id === primaryChatId || chat.id === secondaryChatId);

  // Disable dragging if chat is already open in split view
  const isDragDisabled = isInSplit;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: chat.id,
    data: {
      type: "chat",
      chatId: chat.id,
    },
    disabled: isDragDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`group w-full flex items-center gap-2 rounded-2xl px-3 py-3 text-sm transition-all duration-300 cursor-pointer mb-1 ${
        isActive
          ? "bg-primary/10 text-primary font-medium shadow-none"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      } ${!isSidebarOpen && "justify-center px-0 w-12 h-12 mx-auto aspect-square rounded-2xl"} ${
        isDragging ? "opacity-50 scale-95" : ""
      } ${isInSplit ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}>
      {/* Drag handle - only this element triggers drag */}
      <div
        {...listeners}
        {...attributes}
        className={`${isDragDisabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"} touch-none`}
        title={
          isDragDisabled
            ? "Chat is already open in split view"
            : "Drag to split view"
        }>
        <MessageSquare className="h-4 w-4 shrink-0" />
      </div>

      {/* Clickable area for selection */}
      <button
        onClick={onSelect}
        className={`flex-1 overflow-hidden text-left hover:underline ${
          !isSidebarOpen && "hidden"
        }`}
        title={chat.title || "Untitled Chat"}>
        <span className="truncate">{chat.title || "Untitled Chat"}</span>
      </button>

      {/* Close Split View button */}
      {isSidebarOpen && isInSplit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCloseSplit();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:text-primary transition-opacity mr-1"
          title="Close Split View">
          <ChevronsLeft className="h-4 w-4 rotate-180" />
        </button>
      )}

      {/* Delete button */}
      {isSidebarOpen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
          title="Delete Chat">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default Sidebar;
