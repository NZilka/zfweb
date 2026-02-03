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
  // Start closed, then set based on screen size after mount
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Set default state based on screen size after mount (avoids hydration mismatch)
  useEffect(() => {
    // Desktop defaults to open, mobile/tablet defaults to closed
    const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
    setIsOpen(isDesktop);
    setMounted(true);
  }, []);

  // Close sidebar when resizing to mobile (optional UX improvement)
  useEffect(() => {
    if (!mounted) return;

    const handleResize = () => {
      const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      // Auto-close when going to mobile, auto-open when going to desktop
      setIsOpen(isDesktop);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mounted]);

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  return (
    <AdminNavContext.Provider value={{ isOpen, toggleOpen, close }}>
      {children}
    </AdminNavContext.Provider>
  );
}
