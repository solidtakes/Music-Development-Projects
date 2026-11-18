/** The initial content viewport request. Live and the OS own the outer frame. */
export const MODAL_SIZE = Object.freeze({ width: 790, height: 480 });

/**
 * @param {string} template The self-contained HTML produced by build-modal.mjs.
 * @param {Omit<import('./types.d.ts').EditorSession, 'mode'>} session
 */
export function createModalUrl(template, session) {
  const marker = '<!-- LIVE_SESSION -->';
  if (!template.includes(marker)) throw new Error('Modal template is missing its session placeholder');
  const payload = JSON.stringify({ ...session, mode: 'live' }).replaceAll('<', '\\u003c');
  const html = template.replace(marker, () => `<script id="live-session" type="application/json">${payload}</script>`);
  return `data:text/html,${encodeURIComponent(html)}`;
}
