import { Maximize2 } from "lucide-react";

interface ChatHeaderProps {
  title?: string;
  provider: string;
  model: string;
  onMaximize?: () => void;
  isInSplitView?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = "MOSP Chat",
  provider,
  model,
  onMaximize,
  isInSplitView = false,
}) => {
  return (
    <header
      className={`border-b p-4 flex items-center gap-3 ${isInSplitView ? "bg-primary/10" : "bg-background"}`}>
      <span className="text-2xl">🤖</span>
      <div className="flex-1">
        <h1 className="text-xl font-semibold leading-none">{title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Provider: {provider} | Model: {model}
        </p>
      </div>
      {onMaximize && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMaximize();
          }}
          className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Close split and expand">
          <Maximize2 className="h-4 w-4" />
        </button>
      )}
    </header>
  );
};

export default ChatHeader;
