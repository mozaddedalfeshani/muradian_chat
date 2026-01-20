import React, { useState } from "react";
import { useAppStore } from "../store/appStore";
import ProviderDialog from "./ProviderDialog";
import Sidebar from "./Sidebar";
import ChatPane from "./chat/ChatPane";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";
import { Plus } from "lucide-react";

const ChatApp: React.FC = () => {
  const {
    hasCompletedSetup,
    layout,
    primaryChatId,
    secondaryChatId,
    activePane,
    enableSplitView,
    closeSplitView,
    setPaneChat,
    setActivePane,
  } = useAppStore();

  const [showDropZones, setShowDropZones] = useState(false);

  const handleDragStart = () => {
    setShowDropZones(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setShowDropZones(false);
    const { active, over } = event;

    if (!over) return;

    const chatId = active.data.current?.chatId;
    if (!chatId) return;

    // If dropped on left zone, set as primary
    if (over.id === "drop-zone-left") {
      setPaneChat("primary", chatId);
    }
    // If dropped on right zone, enable split view with this chat as secondary
    else if (over.id === "drop-zone-right") {
      enableSplitView(chatId);
    }
    // If dropped on sidebar, close split view if it was the secondary pane
    else if (over.id === "sidebar") {
      if (chatId === secondaryChatId) {
        closeSplitView();
      }
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen bg-background overflow-hidden">
        {!hasCompletedSetup ? (
          <ProviderDialog open={true} />
        ) : (
          <>
            <Sidebar />

            {layout === "single" ? (
              <div className="flex-1 flex flex-col h-full relative">
                {showDropZones && (
                  <>
                    <DropZone id="drop-zone-left" position="left" />
                    <DropZone id="drop-zone-right" position="right" />
                  </>
                )}
                <ChatPane
                  chatId={primaryChatId}
                  pane="primary"
                  isActive={true}
                  onFocus={() => setActivePane("primary")}
                />
              </div>
            ) : (
              <div className="flex-1 relative h-full overflow-hidden">
                {showDropZones && <DropZone id="sidebar" position="sidebar" />}
                <ResizablePanelGroup
                  {...({ direction: "horizontal" } as any)}
                  className="h-full w-full">
                  <ResizablePanel defaultSize={50} minSize={30}>
                    <ChatPane
                      key={primaryChatId || "primary-empty"}
                      chatId={primaryChatId}
                      pane="primary"
                      isActive={activePane === "primary"}
                      onFocus={() => setActivePane("primary")}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={50} minSize={30}>
                    <ChatPane
                      key={secondaryChatId || "secondary-empty"}
                      chatId={secondaryChatId}
                      pane="secondary"
                      isActive={activePane === "secondary"}
                      onFocus={() => setActivePane("secondary")}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            )}

            <ProviderDialog open={!hasCompletedSetup} />
          </>
        )}
      </div>
    </DndContext>
  );
};

interface DropZoneProps {
  id: string;
  position: "left" | "right" | "sidebar";
}

const DropZone: React.FC<DropZoneProps> = ({ id, position }) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const positionStyles = {
    left: "left-0 w-1/2",
    right: "right-0 w-1/2",
    sidebar: "left-0 w-64",
  };

  return (
    <div
      ref={setNodeRef}
      className={`absolute top-0 h-full ${positionStyles[position]} z-50 pointer-events-auto transition-all ${
        isOver
          ? "bg-primary/20 border-2 border-primary border-dashed"
          : "bg-primary/5 border-2 border-primary/30 border-dashed"
      }`}>
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Plus className="h-8 w-8" />
          <span className="text-sm font-medium">
            {position === "sidebar"
              ? "Drop here to close split"
              : position === "left"
                ? "Drop here for left pane"
                : "Drop here for right pane"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;
