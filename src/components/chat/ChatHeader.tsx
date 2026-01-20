import React from "react";
import { useAppStore } from "../../store/appStore";

const ChatHeader: React.FC = () => {
  const { provider, model } = useAppStore();

  return (
    <header className="border-b bg-background p-4 flex items-center gap-3">
      <span className="text-2xl">🤖</span>
      <div>
        <h1 className="text-xl font-semibold leading-none">Muradian AI</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Provider: {provider} | Model: {model}
        </p>
      </div>
    </header>
  );
};

export default ChatHeader;
