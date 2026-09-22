import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'manual-tts-ui.spec.ts',timeout:60000,workers:1,
  outputDir:'../.runtime/manual-tts-update/ui-results',
  use:{baseURL:'http://127.0.0.1:5174',headless:true,viewport:{width:1440,height:1000},launchOptions:{executablePath:process.env.STORYFORGE_TEST_BROWSER},channel:process.env.STORYFORGE_TEST_BROWSER?undefined:'msedge'},
  webServer:{command:'npm exec vite preview -- --host 127.0.0.1 --port 5174',url:'http://127.0.0.1:5174',reuseExistingServer:false}});
