// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SupportSettingsPanel} from '../src/components/admin/SupportSettingsPanel';
import {api} from '../src/lib/api';
vi.mock('../src/lib/api',async original=>({...await original<typeof import('../src/lib/api')>(),api:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('uploads a QR draft, saves with owner and revision, and removes it',async()=>{
 const empty={settings:{enabled:false,alipay:null,wechat:null},revision:0};
 vi.mocked(api).mockImplementation(async(_url,options)=>options?.method==='POST'?{...(options.body as object),revision:1}:empty);
 render(<SupportSettingsPanel ownerId="admin"/>);
 const file=new File(['fake test PNG'],'qr.png',{type:'image/png'});
 fireEvent.change(await screen.findByLabelText('支付宝收款码'),{target:{files:[file]}});
 await screen.findByAltText('支付宝收款码预览');fireEvent.click(screen.getByLabelText('显示捐赠入口'));fireEvent.click(screen.getByRole('button',{name:'保存'}));
 expect((await screen.findByRole('status')).textContent).toBe('已保存');
 const call=vi.mocked(api).mock.calls.find(([,options])=>options?.method==='POST');expect(call?.[0]).toBe('/api/admin/support');expect(call?.[1]?.headers).toEqual({'X-Workspace-Owner':'admin'});expect((call?.[1]?.body as any).revision).toBe(0);
 fireEvent.click(screen.getByRole('button',{name:'移除'}));expect(screen.queryByAltText('支付宝收款码预览')).toBeNull();
});
it('rejects unsupported file without preview or write',async()=>{
 vi.mocked(api).mockResolvedValue({settings:{enabled:false,alipay:null,wechat:null},revision:0});render(<SupportSettingsPanel ownerId="admin"/>);
 fireEvent.change(await screen.findByLabelText('微信收款码'),{target:{files:[new File(['<svg/>'],'a.svg',{type:'image/svg+xml'})]}});
 expect((await screen.findByRole('alert')).textContent).toContain('1 MiB');expect(screen.queryByRole('img')).toBeNull();expect(vi.mocked(api).mock.calls.some(([,o])=>o?.method==='POST')).toBe(false);
});
