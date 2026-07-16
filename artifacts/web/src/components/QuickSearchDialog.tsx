import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, X, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "3 bedroom house in Harare under $200,000",
  "2 bed apartment to rent in Borrowdale",
  "Stand in Bulawayo under $50,000",
  "House with pool in Highlands or Avondale",
  "Townhouse to rent in Marlborough near shops",
  "Commercial property in the CBD",
];

interface NlpResult {
  listingType?: string;
  propertyType?: string;
  suburb?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  keywords?: string;
}

interface QuickSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickSearchDialog({ open, onOpenChange }: QuickSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setError(null);
    }
  }, [open]);

  const runSearch = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/nlp-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data: NlpResult = await res.json();

      const params = new URLSearchParams();
      if (data.listingType) params.set("listingType", data.listingType);
      if (data.propertyType) params.set("propertyType", data.propertyType);
      if (data.suburb) params.set("q", data.suburb);
      else if (data.city) params.set("q", data.city);
      else if (data.keywords) params.set("q", data.keywords);
      if (data.minPrice) params.set("minPrice", String(data.minPrice));
      if (data.maxPrice) params.set("maxPrice", String(data.maxPrice));
      if (data.minBeds) params.set("minBeds", String(data.minBeds));

      onOpenChange(false);
      setLocation(`/search?${params.toString()}`);
    } catch {
      setError("Couldn't understand that search. Try being more specific.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") runSearch(query);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Quick search
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-5 pb-2">
          <label className="block text-sm text-gray-500 mb-2">
            Describe what you're looking for
          </label>
          <div className="flex items-center border rounded-lg px-3 bg-gray-50 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
            <Search className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 3 bed house in Harare under $200k with a pool"
              className="flex-1 py-3 bg-transparent text-sm outline-none text-gray-900 placeholder:text-gray-400"
              disabled={loading}
            />
            {query && !loading && (
              <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600 ml-1">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}
        </div>

        <div className="px-6 pt-4 pb-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3">Suggested searches</p>
          <div className="space-y-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => runSearch(s)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 bg-white hover:border-primary/30 hover:bg-emerald-50/50 transition-all text-left text-sm text-gray-700 group disabled:opacity-50"
              >
                <Search className="h-4 w-4 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 flex justify-end border-t mt-3">
          <Button
            onClick={() => runSearch(query)}
            disabled={loading || !query.trim()}
            className="min-w-[100px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
