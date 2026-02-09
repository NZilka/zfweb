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
  // Whether close should skip animation (instant disappear on nav)
  isInstantClose: boolean;
  // Toggle sidebar open/closed
  toggleOpen: () => void;
  // Close sidebar (for after navigation on mobile)
  close: () => void;
  // Close sidebar instantly with no animation (for nav link clicks)
  instantClose: () => void;
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
  // When true, skip slide-out animation so drawer vanishes immediately
  const [isInstantClose, setIsInstantClose] = useState(false);

  // Reset instant flag when opening so animation plays normally
  const toggleOpen = () => {
    setIsInstantClose(false);
    setIsOpen((prev) => !prev);
  };
  const close = () => setIsOpen(false);
  // Instant close — sets flag then closes, so CSS transition is removed
  const instantClose = () => {
    setIsInstantClose(true);
    setIsOpen(false);
  };

  return (
    <AdminNavContext.Provider value={{ isOpen, isInstantClose, toggleOpen, close, instantClose }}>
      {children}
    </AdminNavContext.Provider>
  );
}
