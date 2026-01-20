import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";
import { type Message } from "../../store/appStore";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  streamingContent: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  streamingContent,
  messagesEndRef,
}) => {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {messages.length === 0 && !streamingContent && (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
          <span className="text-4xl mb-4">💬</span>
          <p>Start a conversation...</p>
        </div>
      )}
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[75%] rounded-lg px-4 py-2 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted prose dark:prose-invert prose-sm max-w-none break-words"
            }`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
      ))}
      {loading && streamingContent && (
        <div className="flex justify-start">
          <div className="bg-muted rounded-lg px-4 py-2 max-w-[75%] prose dark:prose-invert prose-sm max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {streamingContent}
            </ReactMarkdown>
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          </div>
        </div>
      )}
      {loading && !streamingContent && (
        <div className="flex justify-start">
          <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
