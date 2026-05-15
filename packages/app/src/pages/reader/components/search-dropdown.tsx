import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BookSearchResult } from "@/types/book";
import { Search } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useReaderStore, useReaderStoreApi } from "./reader-provider";
import SearchBar from "./search-bar";
import SearchResults from "./search-results";

export interface ReaderSearchPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
  onResultSelect?: () => void;
}

export function ReaderSearchPanel({ isVisible = true, onClose, onResultSelect }: ReaderSearchPanelProps) {
  const store = useReaderStoreApi();
  const view = store.getState().view;
  const bookData = store.getState().bookData;
  const [searchResults, setSearchResults] = useState<BookSearchResult[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const resetPanelState = useCallback(() => {
    setSearchResults(null);
    setSearchTerm("");
    setHasSearched(false);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      resetPanelState();
    }
  }, [isVisible, resetPanelState]);

  const handleSearchResultClick = useCallback(
    (cfi: string) => {
      resetPanelState();
      onResultSelect?.();

      view?.goTo(cfi);

      if (view) {
        const clearSearchOnClick = () => {
          view.clearSearch();
          window.removeEventListener("message", handleIframeClick);
        };

        const handleIframeClick = (event: MessageEvent) => {
          if (event.data?.type === "iframe-single-click" && event.data?.bookId === bookData?.id) {
            clearSearchOnClick();
          }
        };

        window.addEventListener("message", handleIframeClick);
      }
    },
    [bookData?.id, onResultSelect, resetPanelState, view],
  );

  const handleSearchResultChange = useCallback((results: BookSearchResult[]) => {
    setHasSearched(true);
    setSearchResults(results);
  }, []);

  const handleSearchTermChange = useCallback((term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setHasSearched(false);
      setSearchResults(null);
    }
  }, []);

  const handleHideSearchBar = useCallback(() => {
    resetPanelState();
    onClose?.();
  }, [onClose, resetPanelState]);

  if (!bookData) {
    return null;
  }

  return (
    <div className="flex max-h-[min(70dvh,36rem)] min-h-[18rem] flex-col">
      <div className="sticky top-0 z-10 flex-shrink-0">
        <SearchBar
          isVisible={isVisible}
          searchTerm={searchTerm}
          onSearchResultChange={handleSearchResultChange}
          onSearchTermChange={handleSearchTermChange}
          onHideSearchBar={handleHideSearchBar}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {searchResults && searchResults.length > 0 ? (
          <SearchResults results={searchResults} onSelectResult={handleSearchResultClick} />
        ) : hasSearched && searchResults && searchResults.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="p-12 text-center text-muted-foreground text-sm">未找到搜索结果</div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="p-12 text-center text-muted-foreground text-sm">输入搜索词以查找内容</div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SearchDropdownProps {
  onNavigate?: () => void;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ onNavigate }) => {
  const openDropdown = useReaderStore((state) => state.openDropdown);
  const setOpenDropdown = useReaderStore((state) => state.setOpenDropdown);
  const isSearchDropdownOpen = openDropdown === "search";

  const handleToggleSearchDropdown = (isOpen: boolean) => {
    setOpenDropdown?.(isOpen ? "search" : null);
  };

  const handleCloseSearch = useCallback(() => {
    setOpenDropdown?.(null);
  }, [setOpenDropdown]);

  const handleResultSelect = useCallback(() => {
    setOpenDropdown?.(null);
    onNavigate?.();
  }, [onNavigate, setOpenDropdown]);

  return (
    <DropdownMenu open={isSearchDropdownOpen} onOpenChange={handleToggleSearchDropdown}>
      <DropdownMenuTrigger asChild>
        <button
          className="btn btn-ghost flex items-center justify-center rounded-full p-0 outline-none focus:outline-none focus-visible:ring-0"
          title="搜索"
        >
          <Search size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[min(20rem,calc(100vw-1rem))] p-0"
        align="end"
        side="bottom"
        sideOffset={4}
      >
        <ReaderSearchPanel
          isVisible={isSearchDropdownOpen}
          onClose={handleCloseSearch}
          onResultSelect={handleResultSelect}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SearchDropdown;
