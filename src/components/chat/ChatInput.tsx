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
}) => {
  return (
    <div className="p-4 bg-background">
      <div className="w-full">
        <form
          onSubmit={handleSend}
          className="flex flex-col gap-2 bg-muted/50 rounded-2xl p-4 border border-border/50 focus-within:ring-1 focus-within:ring-ring transition-all">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Message DeepSeek"
            className="min-h-[60px] max-h-[200px] border-none bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none text-base"
            autoFocus
          />

          <div className="flex justify-between items-end">
            <div className="flex gap-2">
              {/* <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full h-8 px-3 text-xs gap-1.5 font-medium border-border/50 bg-background/50 hover:bg-background/80">
                        <Brain className="h-3.5 w-3.5" />
                        DeepThink
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full h-8 px-3 text-xs gap-1.5 font-medium border-border/50 bg-background/50 hover:bg-background/80">
                        <Globe className="h-3.5 w-3.5" />
                        Search
                      </Button> */}
            </div>

            <div className="flex gap-2 items-center">
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
              <Button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="rounded-full h-8 w-8 p-0">
                <ArrowUp className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
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
