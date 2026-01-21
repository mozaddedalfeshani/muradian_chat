import React, { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Edit2, Check, ArrowUp, MessageSquareQuote } from "lucide-react";
import { type Message } from "../../store/appStore";
import { Button } from "../ui/button";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  streamingContent: string;
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
  messagesEndRef,
  onRegenerateFromPoint,
  onAskThis,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopup>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });

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
          <div className="relative max-w-[75%]">
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
                      : `bg-muted prose dark:prose-invert prose-sm break-words ${
                          // Add rainbow glow to the last AI message
                          i === messages.length - 1 && msg.role === "assistant"
                            ? "rainbow-glow-border"
                            : ""
                        }`
                  }`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
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
      {loading && streamingContent && (
        <div className="flex justify-start animate__animated animate__fadeIn animate__faster">
          <div
            data-ai-message="true"
            className="bg-muted rounded-lg px-4 py-2 max-w-[75%] prose dark:prose-invert prose-sm break-words rainbow-glow-border">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {streamingContent}
            </ReactMarkdown>
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          </div>
        </div>
      )}
      {loading && !streamingContent && (
        <div className="flex justify-start animate__animated animate__fadeIn">
          <div className="bg-muted rounded-lg px-4 py-3 max-w-[75%] space-y-2 rainbow-glow-border">
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
