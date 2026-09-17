"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const cleanName = (raw: string) =>
  raw
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .trim()
    .slice(0, 16);

export default function ClerkIdentityBridge({
  onIdentity,
}: {
  onIdentity: (info: {
    signedIn: boolean;
    name: string | null;
    loaded: boolean;
  }) => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded) {
      onIdentity({ signedIn: false, name: null, loaded: false });
      return;
    }
    if (isSignedIn && user) {
      const raw =
        user.username ||
        user.firstName ||
        user.fullName ||
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        "";
      const name = cleanName(raw) || "User";
      onIdentity({ signedIn: true, name, loaded: true });
      return;
    }
    onIdentity({ signedIn: false, name: null, loaded: true });
  }, [isLoaded, isSignedIn, user, onIdentity]);

  return null;
}
