import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  preview: {
    // Allow Render's auto-generated host and any explicitly provided host
    allowedHosts: [
      "safesphere-dm97.onrender.com",
      ...(process.env.RENDER_EXTERNAL_HOSTNAME ? [process.env.RENDER_EXTERNAL_HOSTNAME] : []),
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
