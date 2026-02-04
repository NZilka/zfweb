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

// Typeahead buffer timeout in milliseconds (like native <select>)
const TYPEAHEAD_TIMEOUT = 1000;

// Searchable dropdown component with typeahead navigation
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
  // Typeahead buffer for keyboard navigation (resets after timeout)
  const [typeaheadBuffer, setTypeaheadBuffer] = useState("");
  // -1 means no keyboard selection; first ArrowDown will select index 0
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeaheadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get display label for current value
  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption?.label ?? "";

  // Find index of currently selected value in options
  const selectedIndex = options.findIndex((o) => o.value === value);

  // Clear typeahead timeout on unmount
  useEffect(() => {
    return () => {
      if (typeaheadTimeoutRef.current) {
        clearTimeout(typeaheadTimeoutRef.current);
      }
    };
  }, []);

  // Scroll highlighted item into view (only when an item is selected)
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  // When dropdown opens, highlight the currently selected item
  useEffect(() => {
    if (isOpen && selectedIndex >= 0) {
      setHighlightedIndex(selectedIndex);
    } else if (isOpen) {
      setHighlightedIndex(0);
    }
  }, [isOpen, selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setTypeaheadBuffer("");
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
      setTypeaheadBuffer("");
      buttonRef.current?.focus();
    },
    [onChange]
  );

  // Handle typeahead - find first option starting with buffer
  const handleTypeahead = useCallback(
    (char: string) => {
      // Clear existing timeout
      if (typeaheadTimeoutRef.current) {
        clearTimeout(typeaheadTimeoutRef.current);
      }

      // Add character to buffer
      const newBuffer = typeaheadBuffer + char.toLowerCase();
      setTypeaheadBuffer(newBuffer);

      // Find first option that starts with the buffer
      const matchIndex = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(newBuffer)
      );

      if (matchIndex >= 0) {
        setHighlightedIndex(matchIndex);
      }

      // Reset buffer after timeout
      typeaheadTimeoutRef.current = setTimeout(() => {
        setTypeaheadBuffer("");
      }, TYPEAHEAD_TIMEOUT);
    },
    [typeaheadBuffer, options]
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (options.length > 0) {
          // Move down in the list
          setHighlightedIndex((prev) =>
            prev < 0 ? 0 : prev < options.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          // Move up, but don't go below 0
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
        break;
      case "Enter":
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
          selectOption(options[highlightedIndex].value);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setTypeaheadBuffer("");
        break;
      case "Tab":
        // Allow tab to move focus, close dropdown
        setIsOpen(false);
        setTypeaheadBuffer("");
        break;
      case " ": // Space key - add to typeahead buffer for multi-word searches
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          handleTypeahead(" ");
        }
        break;
      default:
        // Handle typeahead for letter/number keys
        if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          }
          handleTypeahead(e.key);
        }
        break;
    }
  };

  // Handle button click - toggle dropdown, preserve selection
  const handleButtonClick = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button - shows selected value, handles keyboard for typeahead */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "flex w-full items-center justify-between rounded border bg-white px-3 py-2 text-left text-gray-900",
          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          disabled && "cursor-not-allowed opacity-50",
          !displayValue && "text-gray-400 dark:text-gray-500"
        )}
      >
        <span className="truncate">{displayValue || placeholder}</span>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown list - shows all options, typeahead jumps to match */}
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
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => selectOption(option.value)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                // Highlighted state (keyboard nav, hover, or typeahead match) - darker for visibility
                index === highlightedIndex && "bg-gray-300 dark:bg-gray-600",
                // Selected state (checkmark visual)
                option.value === value && "font-medium text-primary"
              )}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
