import type { MetadataRoute } from "next";
import { TOKEN_COLOR_BG, TOKEN_COLOR_PRIMARY } from "@/lib/design-tokens";

// Web app manifest so the app installs to the iPhone home screen (a primary
// target) as a standalone app instead of a browser tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meal Queue",
    short_name: "Meal Queue",
    description: "Plan meals, keep recipes, and generate grocery lists.",
    start_url: "/",
    display: "standalone",
    background_color: TOKEN_COLOR_BG,
    theme_color: TOKEN_COLOR_PRIMARY,
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
