// The hash permits only the theme initializer in index.html before React loads.
export const documentContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'sha256-iY8pYuh2e4xNqd6BXCKHg2uy74WsUq7W/XHNFb+0WXo='",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

// In the configured proxy deployments the ingress rewrites forwarded headers.
export const trustImmediateProxy = (_address: string, hop: number) => hop === 0;
