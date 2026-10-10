import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the built site works from a GitHub Pages sub-path (the app uses hash routes).
export default defineConfig({ base: "./", plugins: [react()] });
