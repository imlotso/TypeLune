import {isWallhavenImageUrl,wallpaperWidths} from './wallpaper-policy.js';
export function wallpaperImageSource(image:string,width=1920){
  if(!isWallhavenImageUrl(image))return image;
  const id=/wallhaven-([a-z0-9]{6})\./.exec(image)![1];const bucket=wallpaperWidths.find(value=>value>=width)??5120;
  return `/api/wallpapers/image/${id}?w=${bucket}`;
}
export function wallpaperImageSet(image:string,adaptive=true){return adaptive&&isWallhavenImageUrl(image)?wallpaperWidths.map(width=>`${wallpaperImageSource(image,width)} ${width}w`).join(', '):undefined;}
