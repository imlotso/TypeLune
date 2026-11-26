export type FeedbackCategory = 'issue' | 'suggestion' | 'article';
export type FeedbackLink = { id: string; title: string; snapshotKey: string; position: string; wrongText: string };
export type FeedbackDraft = { requestId: string; category: FeedbackCategory; title: string; description: string; attachments: File[]; article?: FeedbackLink };

export function feedbackDraftUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newFeedbackDraft(article?: FeedbackLink): FeedbackDraft {
  return { requestId: feedbackDraftUuid(), category: article ? 'article' : 'issue', title: '', description: '', attachments: [], article };
}
