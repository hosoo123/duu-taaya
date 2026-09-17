"use client";

import { ClerkProvider } from "@clerk/nextjs";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

export const clerkEnabled = Boolean(publishableKey);

const clerkAppearance = {
  variables: {
    colorPrimary: "#ff2f55",
    colorDanger: "#ff6a84",
    colorSuccess: "#3ddc97",
    colorText: "#f6f0f2",
    colorTextSecondary: "#8a7f86",
    colorBackground: "#100c12",
    colorInputBackground: "#0a070c",
    colorInputText: "#f6f0f2",
    colorNeutral: "#8a7f86",
    borderRadius: "14px",
    fontFamily: "var(--font-body), Manrope, sans-serif",
    fontFamilyButtons: "var(--font-body), Manrope, sans-serif",
  },
  elements: {
    rootBox: { width: "100%", maxWidth: "420px" },
    cardBox: {
      boxShadow: "0 24px 60px #00000088, inset 0 0 0 1px #ff2f5522",
      borderRadius: "20px",
    },
    card: {
      background: "linear-gradient(165deg, #161018 0%, #0c090e 100%)",
      borderRadius: "20px",
    },
    headerTitle: {
      fontFamily: "var(--font-display), Unbounded, sans-serif",
      fontWeight: "800",
      letterSpacing: "-0.02em",
    },
    headerSubtitle: { color: "#8a7f86" },
    socialButtonsBlockButton: {
      background: "#120d14",
      border: "1px solid #2a2228",
      color: "#f6f0f2",
      boxShadow: "none",
    },
    socialButtonsBlockButtonText: { color: "#f6f0f2", fontWeight: "600" },
    dividerLine: { background: "#241c22" },
    dividerText: { color: "#5c5359" },
    formFieldLabel: { color: "#8a7f86", fontWeight: "600" },
    formFieldInput: {
      background: "#0a070c",
      border: "1px solid #241c22",
      color: "#f6f0f2",
      boxShadow: "none",
    },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #ff2f55, #ff6a84)",
      color: "#fff",
      fontWeight: "700",
      boxShadow: "0 8px 24px #ff2f5540",
    },
    footerActionLink: { color: "#ff6a84", fontWeight: "700" },
    identityPreviewEditButton: { color: "#ff6a84" },
    formFieldInputShowPasswordButton: { color: "#8a7f86" },
    footer: { background: "transparent" },
    footerActionText: { color: "#8a7f86" },
  },
} as const;

export default function AppClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!clerkEnabled) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={clerkAppearance}
    >
      {children}
    </ClerkProvider>
  );
}
