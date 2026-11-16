import { expect,it } from 'vitest';
import { supportImageError } from '../src/lib/support-image-error';
it('explains the exact channel, limit and atomic rejection in both languages',()=>{
 const zh=supportImageError('SUPPORT_IMAGE_ALIPAY_DIMENSIONS',(zh)=>zh);
 expect(zh).toContain('支付宝');expect(zh).toContain('4096');expect(zh).toContain('两张图片均未保存');
 const en=supportImageError('SUPPORT_IMAGE_WECHAT_NORMALIZED_SIZE',(_zh,en)=>en);
 expect(en).toContain('WeChat');expect(en).toContain('lossless');expect(en).toContain('Neither image');
 expect(supportImageError('OTHER',(_zh,en)=>en)).toBeUndefined();
});
