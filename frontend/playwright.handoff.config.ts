import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'youtube-handoff.spec.ts',timeout:30000,workers:1,outputDir:'../.runtime/youtube-handoff/ui-results',
use:{baseURL:'http://127.0.0.1:5174',headless:true,viewport:{width:1500,height:1050},launchOptions:{executablePath:process.env.STORYFORGE_TEST_BROWSER},channel:process.env.STORYFORGE_TEST_BROWSER?undefined:'msedge'},
webServer:{command:'npm exec vite preview -- --host 127.0.0.1 --port 5174',url:'http://127.0.0.1:5174',reuseExistingServer:false}});
