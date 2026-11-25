import {useId,type CSSProperties} from 'react';
import logo from '../assets/typelune-wordmark.jpg';
import { useSiteSeo } from '../hooks/useSiteSeo';
export function BrandLogo() {
  const settings = useSiteSeo();
  const filter=useId();
  return <><svg width="0" height="0" aria-hidden="true" focusable="false" style={{position:'absolute'}}><defs><filter id={filter} x="1%" y="1%" width="98%" height="98%" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -0.2126 -0.7152 -0.0722 0 1"/></filter></defs></svg><img className={'brand-logo'+(!settings.logoUrl?' brand-logo-default':'')} style={!settings.logoUrl?{'--wordmark-alpha':`url(#${filter})`} as CSSProperties:undefined} src={settings.logoUrl || logo} alt={settings.siteName} /></>;
}
