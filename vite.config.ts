import { defineConfig } from "vite";
import {integratedAvrPlugin} from './prototypes/avr-offline/integrated-plugin.mjs';
import react from "@vitejs/plugin-react";
import { readFileSync } from 'node:fs';
import { offlinePlugin, sourceBuild, normalizeBase } from './scripts/offline-plugin.mjs';
const offlinePrototype=process.env.LAB_OFFLINE_AVR==='1';
const root = process.cwd(), base = normalizeBase(process.env.LAB_BASE_PATH), build = sourceBuild(root, base, offlinePrototype?['prototypes/avr-offline']:[]);
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
export default defineConfig(({ command }) => ({
  base,
  plugins: [react(), ...(offlinePrototype?[integratedAvrPlugin(root)]:[]), {name:'lab-development-runtime',configureServer(server){
    // Preserve package-relative ES module imports while the public middleware serves bytes.
    // Older offline caches contain /worker.mjs and /circuit-host.mjs, not this dev namespace.
    server.middlewares.use((request,_response,next)=>{
      if(request.url?.startsWith('/app/development/'))request.url=request.url.slice('/app/development'.length);
      next();
    });
  }}, offlinePlugin(root, build, version, base, offlinePrototype)],
  define: { __OFFLINE_AVR_PROTOTYPE__: JSON.stringify(offlinePrototype), __APP_BUILD__: JSON.stringify(command === 'build' ? build : 'development'), __APP_VERSION__: JSON.stringify(version), __APP_BASE__: JSON.stringify(base) },
  build: { target: "es2022" },
}));
