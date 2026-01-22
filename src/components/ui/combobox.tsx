"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  // For accessibility - describes what this combobox is for
  "aria-label"?: string;
};

// Searchable dropdown component - type to filter options
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // -1 means no keyboard selection; first ArrowDown will select index 0
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Get display label for current value
  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption?.label ?? "";

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset highlighted index when filtered options change
  // -1 means user is typing; ArrowDown will start selection at index 0
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm]);

  // Scroll highlighted item into view (only when an item is selected)
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle option selection
  const selectOption = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      setSearchTerm("");
      inputRef.current?.blur();
    },
    [onChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (filteredOptions.length > 0) {
          // First ArrowDown selects index 0, then increment from there
          setHighlightedIndex((prev) =>
            prev < 0 ? 0 : prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        // Move up, but don't go below 0 once keyboard nav has started
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev < 0 ? 0 : prev));
        break;
      case "Enter":
        e.preventDefault();
        // Only select if an item is highlighted (index >= 0)
        if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex].value);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        break;
      case "Tab":
        // Allow tab to move focus, close dropdown
        setIsOpen(false);
        setSearchTerm("");
        break;
    }
  };

  // Handle input focus - open dropdown and select text
  const handleFocus = () => {
    if (!disabled) {
      setIsOpen(true);
      // Pre-fill search with current value for easy editing
      setSearchTerm(displayValue);
      // Select all text so user can start typing to replace
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  // Handle input change - update search term
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={cn(
            "w-full rounded border bg-white px-3 py-2 pr-8 text-gray-900",
            "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
            "focus:outline-none focus:ring-2 focus:ring-primary/20",
            disabled && "cursor-not-allowed opacity-50"
          )}
        />
        {/* Dropdown arrow */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded border",
            "bg-white text-gray-900 shadow-lg",
            "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          )}
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No results found</li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                onClick={() => selectOption(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  // Highlighted state (keyboard nav or hover) - only when index >= 0
                  highlightedIndex >= 0 &&
                    index === highlightedIndex &&
                    "bg-gray-100 dark:bg-gray-700",
                  // Selected state
                  option.value === value && "font-medium text-primary"
                )}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
