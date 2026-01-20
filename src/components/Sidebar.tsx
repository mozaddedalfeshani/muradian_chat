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

const Sidebar: React.FC = () => {
  const {
    chats,
    addChat,
    currentChatId,
    selectChat,
    deleteChat,
    isSidebarOpen,
    toggleSidebar,
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
        isSidebarOpen ? "w-64" : "w-[70px]"
      } border-r bg-muted/20 flex flex-col h-full transition-all duration-300 ease-in-out`}>
      <div className="p-4">
        <button
          onClick={handleNewChat}
          className={`w-full flex items-center gap-2 justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 ${
            !isSidebarOpen && "px-2"
          }`}
          title="New Chat">
          <Plus className="h-4 w-4" />
          {isSidebarOpen && <span>New Chat</span>}
        </button>
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
          />
        ))}
      </div>

      <div className="p-4 border-t flex flex-col gap-2">
        <div
          className={`flex items-center gap-2 ${!isSidebarOpen && "flex-col"}`}>
          <div
            className={`${!isSidebarOpen ? "w-full flex justify-center" : "flex-1"}`}>
            <SettingsDialog />
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-500 transition-colors"
            title="Toggle Theme">
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-500 transition-colors"
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
}

const DraggableChatItem: React.FC<DraggableChatItemProps> = ({
  chat,
  isActive,
  isSidebarOpen,
  onSelect,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: chat.id,
    data: {
      type: "chat",
      chatId: chat.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`group w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted animate__animated animate__fadeIn animate__faster ${
        isActive ? "bg-muted font-medium" : ""
      } ${!isSidebarOpen && "justify-center px-2"} ${
        isDragging ? "opacity-50" : ""
      }`}>
      {/* Drag handle - only this element triggers drag */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing touch-none"
        title="Drag to split view">
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
