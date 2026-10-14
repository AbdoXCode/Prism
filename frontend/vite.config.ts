import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev proxy so the Vite dev server can talk to FastAPI without CORS issues.
// The backend has no CORSMiddleware, so direct browser -> http://127.0.0.1:8000
// calls fail in dev. With an empty VITE_API_URL (default) the app uses
// relative URLs and Vite forwards them to the backend.
// For production, set VITE_API_URL to your deployed backend URL.
const BACKEND = process.env.VITE_API_URL || "http://127.0.0.1:8000";

// Proxy entry for one backend path.
//
// When the backend is unreachable, http-proxy would answer 500 with an empty
// body — indistinguishable from a real "backend returned 500". We answer 502
// instead so the header status indicator can tell "backend is down" apart from
// "backend returned 500", matching what a network failure looks like in
// production (where the browser hits the API directly and fetch() throws).
function backend(): ProxyOptions {
  return {
    target: BACKEND,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("error", (_err, _req, res) => {
        if (res && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ detail: "Backend unreachable" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/ask": backend(),
      "/upload": backend(),
      "/analyze": backend(),
      "/documents": backend(),
      "/health": backend(),
    },
  },
});
