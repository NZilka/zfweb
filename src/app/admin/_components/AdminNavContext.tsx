/**
 * AdminNavContext - Shared state for admin navigation
 * Manages sidebar drawer open/closed state with responsive defaults
 */
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface AdminNavContextType {
  // Whether sidebar drawer is open
  isOpen: boolean;
  // Toggle sidebar open/closed
  toggleOpen: () => void;
  // Close sidebar (for after navigation on mobile)
  close: () => void;
}

const AdminNavContext = createContext<AdminNavContextType | null>(null);

// Hook to access nav context - throws if used outside provider
export function useAdminNav() {
  const context = useContext(AdminNavContext);
  if (!context) {
    throw new Error("useAdminNav must be used within AdminNavProvider");
  }
  return context;
}

// Desktop breakpoint (lg = 1024px)
const DESKTOP_BREAKPOINT = 1024;

// Provider component wrapping admin layout
export function AdminNavProvider({ children }: { children: ReactNode }) {
  // Start closed - user opens with hamburger menu
  const [isOpen, setIsOpen] = useState(false);

  // On desktop, default to open after initial mount
  useEffect(() => {
    if (window.innerWidth >= DESKTOP_BREAKPOINT) {
      setIsOpen(true);
    }
  }, []);

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  return (
    <AdminNavContext.Provider value={{ isOpen, toggleOpen, close }}>
      {children}
    </AdminNavContext.Provider>
  );
}
