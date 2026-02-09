/**
 * AdminNavContext - Shared state for admin navigation
 * Manages sidebar drawer open/closed state — always starts closed,
 * opened only via hamburger toggle (no auto-open on desktop)
 */
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

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

// Provider component wrapping admin layout
export function AdminNavProvider({ children }: { children: ReactNode }) {
  // Always starts closed — user opens with hamburger menu (no desktop auto-open)
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  return (
    <AdminNavContext.Provider value={{ isOpen, toggleOpen, close }}>
      {children}
    </AdminNavContext.Provider>
  );
}
