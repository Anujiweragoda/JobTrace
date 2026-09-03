import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4001",
        changeOrigin: true,
        configure: (proxy) => {
          // Ensure Authorization header from the browser is forwarded to the backend
          // in case some proxy setups drop it.
            try {
            proxy.on("proxyReq", (proxyReq: any, req: any, _res: any) => {
              const auth = req.headers["authorization"] || req.headers["Authorization"];
              if (auth) {
                proxyReq.setHeader("authorization", auth as string);
              }
            });
          } catch (e) {
            // ignore if proxy doesn't support events in this environment
          }
        },
      },
    },
  },
});
