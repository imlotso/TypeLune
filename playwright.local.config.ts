import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// The companion runner owns one disposable server. Avoid Windows SIGTERM
// webServer teardown, while keeping every normal browser test/expectation.
export default defineConfig({ ...base, webServer: undefined });
