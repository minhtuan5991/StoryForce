import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'capcut-export.spec.ts',timeout:45000,workers:1,outputDir:'../.runtime/capcut-ui/results',
  use:{baseURL:'http://127.0.0.1:5177',headless:true,viewport:{width:1500,height:1050},launchOptions:{executablePath:process.env.STORYFORGE_TEST_BROWSER},channel:process.env.STORYFORGE_TEST_BROWSER?undefined:'msedge'},
  webServer:{command:'npm exec vite preview -- --host 127.0.0.1 --port 5177',url:'http://127.0.0.1:5177',reuseExistingServer:false}});
