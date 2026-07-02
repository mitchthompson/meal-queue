import "./globals.css";
import type { Metadata, Viewport } from "next";
import { TOKEN_COLOR_BG } from "@/lib/design-tokens";

export const metadata: Metadata = {
  title: {
    default: "Meal Queue",
    template: "%s · Meal Queue",
  },
  description: "Plan meals, keep recipes, and generate grocery lists.",
};

export const viewport: Viewport = {
  themeColor: TOKEN_COLOR_BG,
  // Required for env(safe-area-inset-*) to resolve on iOS — without it the
  // values are 0 and the fixed mobile tabbar collides with the home indicator
  // when the app is installed to the home screen (standalone display).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
