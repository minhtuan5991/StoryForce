import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:['bridge-media.spec.ts','bridge-download-api.spec.ts','media-automation-ui.spec.ts','capcut-export.spec.ts'],timeout:30000,workers:1,
  use:{baseURL:'http://127.0.0.1:8857',channel:'msedge',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
  webServer:{command:'npm run dev -- --port 8857 --strictPort',url:'http://127.0.0.1:8857',reuseExistingServer:false}});
