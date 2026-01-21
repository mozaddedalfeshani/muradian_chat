import React, { useState } from "react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ChevronDown, Check, Search } from "lucide-react";

interface ModelSelectorProps {
  provider: string;
  model: string;
  models: string[];
  setModel: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  provider,
  model,
  models,
  setModel,
}) => {
  const [modelSearch, setModelSearch] = useState("");
  const [open, setOpen] = useState(false);

  if (provider !== "openrouter" && provider !== "muradian") return null;

  if (provider === "muradian") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-xs font-normal text-muted-foreground hover:text-foreground">
        Muradian Auto
        <span className="ml-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          Fine Tuning
        </span>
      </Button>
    );
  }

  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  const handleSelectModel = (m: string) => {
    setModel(m);
    setOpen(false); // Close popover after selection
    setModelSearch(""); // Reset search
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs font-normal text-muted-foreground hover:text-foreground">
          {model || "Select Model"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center px-2 border rounded-md bg-muted/50">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              className="flex h-9 w-full rounded-md bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search models..."
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="p-1 max-h-[300px] overflow-y-auto">
          {filteredModels.length > 0 ? (
            filteredModels.map((m) => (
              <Button
                key={m}
                type="button"
                variant="ghost"
                size="sm"
                className={`w-full justify-between font-normal text-xs ${
                  model === m ? "bg-accent text-accent-foreground" : ""
                }`}
                onClick={() => handleSelectModel(m)}>
                <span className="truncate text-left">{m}</span>
                {model === m && <Check className="h-3 w-3 ml-2 shrink-0" />}
              </Button>
            ))
          ) : (
            <div className="text-xs text-center text-muted-foreground py-4">
              No models found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ModelSelector;
