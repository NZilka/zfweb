/**
 * Client-side providers wrapper
 * Combines all context providers needed for the application
 */
"use client";

import { PostHogProvider } from "~/lib/posthog";
import { type ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Providers component wraps the app with necessary client-side contexts
 * Currently includes:
 * - PostHog for analytics and event tracking
 */
export function Providers({ children }: ProvidersProps) {
  return <PostHogProvider>{children}</PostHogProvider>;
}
