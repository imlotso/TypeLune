import type { ApiError } from './api';
export function supportImageError(code: ApiError['code'], t: (zh: string, en: string) => string): string | undefined {
 const match = /^SUPPORT_IMAGE_(ALIPAY|WECHAT)_(FORMAT|SIZE|DIMENSIONS|FRAMES|NORMALIZED_SIZE)$/.exec(code ?? '');
 if (!match) return;
 const channel = match[1] === 'ALIPAY' ? t('支付宝收款码', 'Alipay QR code') : t('微信收款码', 'WeChat Pay QR code');
 const messages: Record<string, string> = {
  FORMAT: t('图片无法解码或格式不符，请重新导出 PNG、JPG 或 WebP。', 'Image cannot be decoded or its format does not match. Export a PNG, JPG or WebP again.'),
  SIZE: t('文件超过 1 MiB，请选择较小的原始收款码图片。', 'File exceeds 1 MiB. Choose a smaller original payment-code image.'),
  DIMENSIONS: t('单边超过 4096 像素或总像素超过 400 万。请导出较小图片并确认仍能扫码。', 'An edge exceeds 4096 pixels or the image exceeds 4 million pixels. Export a smaller image and verify it still scans.'),
  FRAMES: t('只支持静态单帧图片，不支持动图。', 'Only static single-frame images are supported.'),
  NORMALIZED_SIZE: t('去除隐私元数据后的无损图片超过 1 MiB。请重新导出简洁的原始收款码图片并确认能扫码；系统不会自动模糊或裁剪二维码。', 'The lossless image exceeds 1 MiB after removing private metadata. Export a simpler original code image and verify it scans; the system will not blur or crop your QR code.'),
 };
 return `${channel}: ${messages[match[2]]} ${t('本次两张图片均未保存，已有配置未变。', 'Neither image in this update was saved. Existing settings are unchanged.')}`;
}
