import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Offline 100%: ao final do build, lista todos os arquivos de dist/ em
 * precache-manifest.json e carimba o sw.js com um ID único do build, para
 * o Service Worker baixar o app inteiro na instalação.
 */
export function jjyOfflinePrecache({
  skip = /\.(bat|cmd|ps1|hta|exe|zip|map|mp4|webm)$|(^|\/)\.htaccess$|^sw\.js$|^precache-manifest\.json$/i,
  maxBytes = 6 * 1024 * 1024,
} = {}) {
  let outDir = "dist";
  return {
    name: "jjy-offline-precache",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!fs.existsSync(outDir)) return;
      const files = [];
      const hash = crypto.createHash("sha256");
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          const rel = path.relative(outDir, full).split(path.sep).join("/");
          if (skip.test(rel) || fs.statSync(full).size > maxBytes) continue;
          files.push("./" + encodeURI(rel));
          hash.update(rel).update(fs.readFileSync(full));
        }
      };
      walk(outDir);
      const buildId = hash.digest("hex").slice(0, 12);
      fs.writeFileSync(path.join(outDir, "precache-manifest.json"), JSON.stringify({ buildId, files }, null, 2));
      const swPath = path.join(outDir, "sw.js");
      if (fs.existsSync(swPath)) {
        fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8").replaceAll("__BUILD_ID__", buildId));
      }
      console.log(`\n[jjy-offline] ${files.length} arquivos no precache · build ${buildId}`);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), jjyOfflinePrecache()],
  esbuild: {
    target: "esnext",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-icons": ["lucide-react"],
          "vendor-charts": ["recharts"],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4870",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:4870",
        ws: true,
      },
    },
    watch: {
      ignored: ["**/release/**", "**/recordings/**", "**/*.exe", "**/*.mp4", "**/*.webm"],
    },
  },
});
