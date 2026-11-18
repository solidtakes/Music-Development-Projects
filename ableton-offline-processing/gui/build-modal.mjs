import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Inline CSS and browser modules so the SDK Webview needs no server or local asset URL. */
export async function buildModal() {
  const [html, css, script] = await Promise.all(
    ['index.html', 'editor.css', 'editor.js'].map((name) => readFile(new URL(name, import.meta.url), 'utf8')),
  );
  return html
    .replace('<link rel="stylesheet" href="./editor.css">', () => `<style>\n${css}</style>`)
    .replace('<script type="module" src="./editor.js"></script>', () => `<script type="module">\n${script}</script>`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const folder = new URL('./dist/', import.meta.url);
  await mkdir(folder, { recursive: true });
  await writeFile(new URL('modal.html', folder), await buildModal());
}
