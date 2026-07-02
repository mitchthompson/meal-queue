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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
