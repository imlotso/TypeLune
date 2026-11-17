// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { defaultSettings } from '../src/lib/models';
import { putWorkspaceValue, readWorkspace, saveWallpaper, workspaceValue } from '../src/lib/workspace';
import { defaultBackground } from '../src/lib/background';
it('keeps the previous image and update preference together when persistent storage fails',async()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3cAAAAASUVORK5CYII=';
 const background=defaultBackground('dark',{image:png,name:'before.png',width:1,height:1});
 await putWorkspaceValue(null,'background','dark',background);await putWorkspaceValue(null,'settings','preferences',defaultSettings);
 const fail=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('full','QuotaExceededError');});
 await expect(saveWallpaper(null,'dark',{...background,name:'new.png'},'nature')).rejects.toThrow();fail.mockRestore();
 const previous=await readWorkspace(null);expect(workspaceValue(previous,'background','dark')?.name).toBe('before.png');expect(workspaceValue(previous,'settings','preferences')?.wallpapers).toBeUndefined();
 await saveWallpaper(null,'dark',{...background,name:'new.png'},'nature');const next=await readWorkspace(null);expect(workspaceValue(next,'background','dark')?.name).toBe('new.png');expect(workspaceValue(next,'settings','preferences')?.wallpapers?.dark).toBe('nature');
});

it('persists display adaptation per theme without overwriting other background preferences',async()=>{
 await putWorkspaceValue('display-owner','settings','preferences',{...defaultSettings,wallpapers:{dark:'portrait'},wallpaperAdaptive:{dark:false}});
 await saveWallpaper('display-owner','light',undefined,'off',true);
 const saved=workspaceValue(await readWorkspace('display-owner'),'settings','preferences');
 expect(saved?.wallpaperAdaptive).toEqual({light:true,dark:false});expect(saved?.wallpapers).toEqual({light:'off',dark:'portrait'});
});
