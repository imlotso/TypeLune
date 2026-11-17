import { useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { isBackgroundConfig, type BackgroundConfig, type BackgroundTheme } from '../lib/background';

export function RoomBackground({ theme, background, children }: { theme: BackgroundTheme; background?: BackgroundConfig; children: ReactNode }) {
  const [failed, setFailed] = useState<string>();
  const valid = useMemo(() => isBackgroundConfig(background), [background]);
  const custom = background && background.image !== failed && valid ? background : undefined;
  const surface = custom ? {
    '--wallpaper-panel-opacity': (custom.panelOpacity ?? (theme==='dark'?95:97))/100,
    '--wallpaper-workspace-opacity': (custom.workspaceOpacity ?? (theme==='dark'?95:92))/100,
    '--wallpaper-panel-blur': `${custom.panelBlur??0}px`, '--wallpaper-border-opacity': `${custom.borderOpacity??100}%`,
  } as CSSProperties : undefined;
  return <main className={`room${custom ? ' room-custom' : ''}`} style={surface}>
    {custom && <div className="custom-background" data-theme={theme} aria-hidden="true">
      <img data-testid="custom-background-image" src={custom.image} alt="" referrerPolicy="no-referrer" onError={() => setFailed(custom.image)}
        style={{ objectFit: custom.fit, objectPosition: `${custom.positionX}% ${custom.positionY}%`, filter: `blur(${custom.blur}px)` }} />
      <div className="background-shade" style={{ opacity: custom.shade / 100 }} />
    </div>}
    {children}
    {custom?.daily && <a className="wallpaper-credit" href={"https://wallhaven.cc/w/"+custom.daily.id} target="_blank" rel="noopener noreferrer">Wallhaven ↗</a>}
  </main>;
}
