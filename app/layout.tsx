import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { TOKEN_COLOR_BG } from "@/lib/design-tokens";

const headingFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

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
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
