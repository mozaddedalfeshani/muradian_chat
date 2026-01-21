import React, { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Copy,
  Edit2,
  Check,
  ArrowUp,
  MessageSquareQuote,
  ChevronDown,
  ChevronUp,
  Brain,
} from "lucide-react";
import { type Message } from "../../store/appStore";
import { Button } from "../ui/button";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  streamingContent: string;
  streamingThinking?: string;
  thinkingStatus?: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onRegenerateFromPoint?: (index: number, newContent: string) => void;
  onAskThis?: (text: string) => void;
}

interface SelectionPopup {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  streamingContent,
  streamingThinking,
  thinkingStatus,
  messagesEndRef,
  onRegenerateFromPoint,
  onAskThis,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [editContent, setEditContent] = useState("");
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopup>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });

  // Preprocess content to convert various LaTeX delimiters to $$ format
  const preprocessMath = (content: string) => {
    if (!content) return content;

    // Convert \[ ... \] to $$ ... $$ (display math)
    let processed = content.replace(
      /\\\[([\s\S]*?)\\\]/g,
      "$$$$" + "$1" + "$$$$",
    );

    // Convert [ ... ] standalone math blocks (when on own line or with leading text)
    // Match patterns like ": [ \frac{...} ]"
    processed = processed.replace(
      /\[\s*(\\[a-zA-Z]+[\s\S]*?)\s*\]/g,
      (match, math) => {
        // Check if it looks like LaTeX (contains backslash commands)
        if (math.includes("\\")) {
          return "$$" + math.trim() + "$$";
        }
        return match;
      },
    );

    // Convert \( ... \) to $ ... $ (inline math)
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$$");

    return processed;
  };

  const handleCopy = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEdit = (index: number, content: string) => {
    setEditingIndex(index);
    setEditContent(content);
  };

  const handleSaveEdit = (index: number) => {
    if (onRegenerateFromPoint && editContent.trim()) {
      onRegenerateFromPoint(index, editContent);
      setEditingIndex(null);
      setEditContent("");
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditContent("");
  };

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionPopup((prev) => ({ ...prev, visible: false }));
      return;
    }

    const selectedText = selection.toString().trim();

    // Check if selection is within an AI message
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const messageElement = (
      container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : (container as HTMLElement)
    )?.closest('[data-ai-message="true"]');

    if (!messageElement) {
      setSelectionPopup((prev) => ({ ...prev, visible: false }));
      return;
    }

    const rect = range.getBoundingClientRect();
    const scrollContainer = document.querySelector(".flex-1.overflow-auto");
    const containerRect = scrollContainer?.getBoundingClientRect() || {
      left: 0,
      top: 0,
    };

    setSelectionPopup({
      visible: true,
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top - 40,
      text: selectedText,
    });
  }, []);

  const handleAskThis = () => {
    if (onAskThis && selectionPopup.text) {
      onAskThis(selectionPopup.text);
      setSelectionPopup((prev) => ({ ...prev, visible: false }));
      window.getSelection()?.removeAllRanges();
    }
  };

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    document.addEventListener("keyup", handleTextSelection);

    return () => {
      document.removeEventListener("mouseup", handleTextSelection);
      document.removeEventListener("keyup", handleTextSelection);
    };
  }, [handleTextSelection]);

  // Hide popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-selection-popup="true"]')) {
        setSelectionPopup((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4 relative">
      {/* Text Selection Popup */}
      {selectionPopup.visible && (
        <div
          data-selection-popup="true"
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-1 animate-in fade-in zoom-in-95"
          style={{
            left: `${selectionPopup.x}px`,
            top: `${selectionPopup.y}px`,
            transform: "translateX(-50%)",
          }}>
          <Button
            size="sm"
            variant="ghost"
            className="flex items-center gap-2 text-sm"
            onClick={handleAskThis}>
            <MessageSquareQuote className="h-4 w-4" />
            Ask this
          </Button>
        </div>
      )}

      {messages.length === 0 && !streamingContent && (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 animate__animated animate__fadeIn">
          <span className="text-4xl mb-4">💬</span>
          <p>Start a conversation...</p>
        </div>
      )}
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate__animated animate__fadeIn animate__faster group`}>
          <div className="relative max-w-[95%]">
            {editingIndex === i ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[100px] rounded-lg px-4 py-2 bg-primary/10 border border-primary resize-y"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => handleSaveEdit(i)}
                    title="Send edited message">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div
                  data-ai-message={
                    msg.role === "assistant" ? "true" : undefined
                  }
                  className={`rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : `w-full bg-muted prose dark:prose-invert prose-sm break-words ${
                          // Add rainbow glow to the last AI message
                          i === messages.length - 1 && msg.role === "assistant"
                            ? "rainbow-glow-border"
                            : ""
                        }`
                  }`}>
                  {/* Thinking section for saved messages */}
                  {msg.thinking && msg.role === "assistant" && (
                    <div className="mb-3 border-b border-border/50 pb-3 not-prose">
                      <button
                        onClick={() => setShowThinking(!showThinking)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="font-medium">View reasoning</span>
                        {showThinking ? (
                          <ChevronUp className="h-4 w-4 ml-auto" />
                        ) : (
                          <ChevronDown className="h-4 w-4 ml-auto" />
                        )}
                      </button>
                      {showThinking && (
                        <div className="mt-2 text-sm text-muted-foreground italic pl-6 border-l-2 border-primary/30 max-h-[200px] overflow-y-auto">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}>
                            {msg.thinking}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}>
                    {preprocessMath(msg.content)}
                  </ReactMarkdown>
                </div>
                <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7 rounded-full shadow-md"
                    onClick={() => handleCopy(msg.content, i)}
                    title="Copy message">
                    {copiedIndex === i ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  {msg.role === "user" && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 rounded-full shadow-md"
                      onClick={() => handleEdit(i, msg.content)}
                      title="Edit message">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
      {loading && (streamingContent || streamingThinking) && (
        <div className="flex justify-start animate__animated animate__fadeIn animate__faster">
          <div className="relative max-w-[95%]">
            <div
              data-ai-message="true"
              className="w-full bg-muted rounded-lg px-4 py-2 prose dark:prose-invert prose-sm break-words rainbow-glow-border">
              {/* Thinking section */}
              {streamingThinking && (
                <div className="mb-3 border-b border-border/50 pb-3">
                  <button
                    onClick={() => setShowThinking(!showThinking)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
                    <Brain className="h-4 w-4 text-primary animate-pulse" />
                    <span className="font-medium">AI is reasoning...</span>
                    {showThinking ? (
                      <ChevronUp className="h-4 w-4 ml-auto" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-auto" />
                    )}
                  </button>
                  {showThinking && (
                    <div className="mt-2 text-sm text-muted-foreground italic pl-6 border-l-2 border-primary/30 max-h-[200px] overflow-y-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}>
                        {streamingThinking}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
              {/* Main response content */}
              {streamingContent && (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}>
                    {preprocessMath(streamingContent)}
                  </ReactMarkdown>
                  <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {loading && !streamingContent && (
        <div className="flex justify-start animate__animated animate__fadeIn">
          <div className="bg-muted rounded-lg px-4 py-3 max-w-[95%] space-y-2 rainbow-glow-border">
            {thinkingStatus && (
              <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse" />
                {thinkingStatus}
              </div>
            )}
            <div className="h-4 bg-foreground/10 rounded animate-pulse w-48" />
            <div className="h-4 bg-foreground/10 rounded animate-pulse w-36" />
            <div className="h-4 bg-foreground/10 rounded animate-pulse w-52" />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
