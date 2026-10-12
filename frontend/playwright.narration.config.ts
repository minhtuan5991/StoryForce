import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',testMatch:'narration-setup.spec.ts',timeout:60000,workers:1,
  use:{baseURL:'http://127.0.0.1:5173',channel:'msedge',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
  webServer:{command:'"..\\.venv\\Scripts\\python.exe" -m uvicorn backend.api:create_app --factory --app-dir ".." --host 127.0.0.1 --port 5173',
    url:'http://127.0.0.1:5173/api/health',reuseExistingServer:false,timeout:30000,
    env:{STORYFORGE_DATA_ROOT:'..\\.runtime\\narration-ui-'+Date.now()}},
});
