// The UI suite uses Chinese labels, just like Playwright's default locale.
// Locale-detection tests explicitly override this browser fixture.
if (typeof window !== 'undefined' && window.navigator) {
  Object.defineProperty(window.navigator, 'languages', { configurable: true, get: () => ['zh-CN'] });
  Object.defineProperty(window.navigator, 'language', { configurable: true, get: () => 'zh-CN' });
}
