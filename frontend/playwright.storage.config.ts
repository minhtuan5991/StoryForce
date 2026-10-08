import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'resource-cleanup.spec.ts',timeout:60000,workers:1,
  use:{baseURL:'http://127.0.0.1:5184',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure',
    ...(process.env.STORYFORGE_TEST_BROWSER?{launchOptions:{executablePath:process.env.STORYFORGE_TEST_BROWSER}}:{channel:'msedge'})},
  webServer:{command:'npm exec vite preview -- --host 127.0.0.1 --port 5184 --strictPort',url:'http://127.0.0.1:5184',reuseExistingServer:false,timeout:30000}});
