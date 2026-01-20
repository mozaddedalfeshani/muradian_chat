import React from "react";
import { useAppStore } from "../../store/appStore";

const ChatHeader: React.FC = () => {
  const { provider, model, chats, currentChatId } = useAppStore();

  const currentChat = chats.find((c) => c.id === currentChatId);
  const title = currentChat?.title || "Muradian AI";

  return (
    <header className="border-b bg-background p-4 flex items-center gap-3">
      <span className="text-2xl">🤖</span>
      <div>
        <h1 className="text-xl font-semibold leading-none">{title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Provider: {provider} | Model: {model}
        </p>
      </div>
    </header>
  );
};

export default ChatHeader;
