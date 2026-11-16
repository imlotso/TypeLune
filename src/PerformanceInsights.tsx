import { SpeedInsights } from '@vercel/speed-insights/react';
import { filterSpeedInsight, shouldCollectSpeedInsights } from './lib/speed-insights';

export function PerformanceInsights() {
  if (!shouldCollectSpeedInsights(import.meta.env.VITE_VERCEL_HOST, import.meta.env.VITE_VERCEL_ENV)) return null;
  return <SpeedInsights beforeSend={filterSpeedInsight} sampleRate={0.1} debug={false} />;
}
