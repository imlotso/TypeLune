import logo from '../assets/typelune-wordmark.jpg';
import { useSiteSeo } from '../hooks/useSiteSeo';
export function BrandLogo() {
  const settings = useSiteSeo();
  return <img className="brand-logo" src={settings.logoUrl || logo} alt={settings.siteName} />;
}
