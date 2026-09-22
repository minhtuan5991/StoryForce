import {defineConfig} from '@playwright/test';

// Isolated DOM fixtures; never opens the user's browser profile or sends to AI.
export default defineConfig({
  testDir:'./e2e', testMatch:'bridge-auto.spec.ts', timeout:60000, workers:1,
  outputDir:'../.runtime/comet-bridge/test-results',
  use:{headless:true,launchOptions:{executablePath:process.env.STORYFORGE_TEST_BROWSER},
    channel:process.env.STORYFORGE_TEST_BROWSER?undefined:'msedge'},
});
