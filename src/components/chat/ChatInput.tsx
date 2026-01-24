import React from "react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Paperclip, ArrowUp } from "lucide-react";
import ModelSelector from "./ModelSelector";

interface ChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSend: (e: React.FormEvent) => void;
  loading: boolean;
  provider: string;
  model: string;
  models: string[];
  setModel: (model: string) => void;
  handleStop?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  setInputValue,
  handleSend,
  loading,
  provider,
  model,
  models,
  setModel,
  handleStop,
}) => {
  return (
    <div className="p-2 bg-background">
      <div className="w-full">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 bg-muted/50 rounded-xl p-2 pl-4 border border-border/50 focus-within:ring-1 focus-within:ring-ring transition-all">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Write your message here..."
            className="flex-1 min-h-[40px] max-h-[120px] border-none bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none text-base py-2"
            autoFocus
          />

          <div className="flex items-center gap-1 pr-1">
            <ModelSelector
              provider={provider}
              model={model}
              models={models}
              setModel={setModel}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 text-muted-foreground hover:bg-muted">
              <Paperclip className="h-4 w-4" />
            </Button>
            {loading ? (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (handleStop) handleStop();
                }}
                className="rounded-full h-8 w-8 p-0 bg-red-500 hover:bg-red-600 text-white">
                <div className="h-3 w-3 bg-current rounded-[2px]" />
                <span className="sr-only">Stop</span>
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!inputValue.trim()}
                className="rounded-full h-8 w-8 p-0">
                <ArrowUp className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            )}
          </div>
        </form>

        {/* <div className="mt-2 text-center text-xs text-muted-foreground">
                  Context:{" "}
                  <span className="font-mono">{messages.length} messages</span>
                </div> */}
      </div>
    </div>
  );
};

export default ChatInput;
