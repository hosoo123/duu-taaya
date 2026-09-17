"use client";

import { ClerkProvider } from "@clerk/nextjs";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

export const clerkEnabled = Boolean(publishableKey);

export default function AppClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!clerkEnabled) return <>{children}</>;
  return (
    <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
  );
}
