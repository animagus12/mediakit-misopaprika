"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { searchRecords } from "@/app/search/actions";
import type { GlobalSearchResult, GlobalSearchResultType } from "@/lib/globalSearch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const categoryLabels: Record<GlobalSearchResultType, string> = {
  brand: "Brands",
  campaign: "Campaigns",
  invoice: "Invoices",
  contact: "Contacts",
};

const iconButton = "size-7 pointer-coarse:size-11 [&_svg]:size-4 pointer-coarse:[&_svg]:size-5";

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastShiftAt = useRef<number | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Shift" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;

      const now = Date.now();
      if (lastShiftAt.current !== null && now - lastShiftAt.current <= 500) {
        lastShiftAt.current = null;
        setOpen(true);
        return;
      }
      lastShiftAt.current = now;
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;

    let current = true;
    const timeout = window.setTimeout(() => {
      void searchRecords(normalizedQuery).then((response) => {
        if (!current) return;
        if (response.success) {
          setResults(response.results);
          setError(null);
        } else {
          setResults([]);
          setError(response.error);
        }
      }).catch((searchError: unknown) => {
        if (!current) return;
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "Search is temporarily unavailable");
      }).finally(() => {
        if (current) setIsLoading(false);
      });
    }, 200);

    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }

  const groupedResults = (Object.keys(categoryLabels) as GlobalSearchResultType[])
    .map((type) => ({
      type,
      results: results.filter((result) => result.type === type),
    }))
    .filter((group) => group.results.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="icon"
        className={iconButton}
        aria-label="Search"
        title="Search (double-press Shift)"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>
      <DialogContent className="top-[10vh] max-h-[80vh] gap-0 overflow-hidden p-0 sm:top-[15vh]">
        <DialogHeader className="border-b border-border px-4 py-3 pr-12">
          <DialogTitle>Search your workspace</DialogTitle>
          <DialogDescription>
            Find brands, campaigns, invoices, and contacts.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">
          <Input
            autoFocus
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setResults([]);
              setError(null);
              setIsLoading(nextQuery.trim().length >= 2);
            }}
            placeholder="Search records..."
            aria-label="Search records"
            aria-describedby="global-search-hint"
            maxLength={100}
          />
          <p id="global-search-hint" className="mt-2 text-[0.6875rem] text-muted-foreground">
            Type at least 2 characters. Press Shift twice to open search.
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-2 pb-2" aria-live="polite">
          {isLoading && (
            <p className="px-3 py-5 text-center text-xs text-muted-foreground">Searching...</p>
          )}
          {!isLoading && error && (
            <p role="alert" className="px-3 py-5 text-center text-xs text-destructive">{error}</p>
          )}
          {!isLoading && !error && query.trim().length >= 2 && groupedResults.length === 0 && (
            <p className="px-3 py-5 text-center text-xs text-muted-foreground">No matching records.</p>
          )}
          {!isLoading && groupedResults.map((group) => (
            <section key={group.type} aria-label={categoryLabels[group.type]} className="pb-2">
              <h3 className="px-3 py-2 text-[0.6875rem] font-medium text-muted-foreground">
                {categoryLabels[group.type]}
              </h3>
              <ul>
                {group.results.map((result) => (
                  <li key={`${result.type}:${result.href}:${result.label}`}>
                    <Link
                      href={result.href}
                      onClick={() => handleOpenChange(false)}
                      className="flex min-h-10 items-center justify-between gap-3 rounded-md px-3 py-2 text-xs outline-none hover:bg-muted focus-visible:bg-muted"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">{result.label}</span>
                      <span className="shrink-0 truncate text-muted-foreground">{result.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
