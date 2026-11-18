// @ts-check
/** @typedef {import('./types.d.ts').EditorSession} EditorSession */
/** @typedef {import('./types.d.ts').ModalResult} ModalResult */
/** @typedef {import('./types.d.ts').Operation} Operation */
/** @typedef {import('./types.d.ts').OperationPlan} OperationPlan */
/** @typedef {import('./types.d.ts').RenderReport} RenderReport */
/** @typedef {import('./types.d.ts').RenderState} RenderState */

const MIN_GAIN = -60;
const MAX_GAIN = 24;
const DEFAULT_GAIN = -3;

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {string} id
 * @param {K} tag
 * @returns {HTMLElementTagNameMap[K]}
 */
function control(id, tag) {
  const element = document.querySelector(`${tag}#${id}`);
  if (!element) throw new Error(`Missing control: ${id}`);
  return /** @type {HTMLElementTagNameMap[K]} */ (element);
}

const status = control('status', 'span');
const progress = control('progress', 'progress');
const devices = control('devices', 'ol');
const inspector = control('device-title', 'h3');
const deviceDescription = control('device-description', 'p');
const deviceTemplate = control('device-template', 'template');
const gainPanel = control('gain-controls', 'div');
const gain = control('gain', 'input');
const gainValue = control('gain-value', 'output');
const theme = control('theme', 'select');
const timeline = control('waveform', 'canvas');
const renderButton = control('render', 'button');
const cancelButton = control('cancel', 'button');
const addReverse = control('add-reverse', 'button');
const addGain = control('add-gain', 'button');
const audio = control('audio', 'audio');
const audition = control('audition', 'button');
const audioTarget = control('audition-target', 'select');
const outputOption = audioTarget.options[1];

gain.min = String(MIN_GAIN);
gain.max = String(MAX_GAIN);
gain.step = '0.01';

/** @type {EditorSession | null} */
let session = null;
/** @type {Operation[]} */
let operations = [];
/** @type {string | null} */
let selected = null;
/** @type {RenderReport | undefined} */
let report;
/** @type {string | undefined} */
let outputAudio;
/** @type {{ id: string; controller: AbortController } | null} */
let activeRender = null;
let resultOnly = false;
let animationFrame = 0;

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** @param {number} seconds @param {boolean} [milliseconds] */
function timeLabel(seconds, milliseconds = false) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds) % 60;
  const partial = Math.floor((seconds % 1) * 1000);
  return `${minutes}:${String(remainder).padStart(2, '0')}${milliseconds ? `.${String(partial).padStart(3, '0')}` : ''}`;
}

/** @param {number} value */
function gainLabel(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)} dB`.replace('-', '−');
}

/** @param {number | undefined} bytes */
function bytesLabel(bytes) {
  return bytes === undefined ? '—' : `${bytes.toLocaleString('en-US')} B`;
}

function drawWaveform() {
  if (!session) return;
  const { width, height } = timeline.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  const canvasWidth = Math.round(width * ratio);
  const canvasHeight = Math.round(height * ratio);
  if (timeline.width !== canvasWidth || timeline.height !== canvasHeight) {
    timeline.width = canvasWidth;
    timeline.height = canvasHeight;
  }
  const ctx = timeline.getContext('2d');
  if (!ctx) return;
  const style = getComputedStyle(document.documentElement);
  /** @param {string} name */
  const color = (name) => style.getPropertyValue(name).trim();
  const inset = 7;
  const clipWidth = width - inset * 2;
  const top = 19;
  const labelHeight = 17;
  const bottom = height - 6;
  const waveMid = (top + labelHeight + bottom) / 2;
  const waveHeight = (bottom - top - labelHeight) / 2 - 2;
  const duration = session.source.format.durationSeconds;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color('--clip');
  ctx.fillRect(inset, top, clipWidth, bottom - top);
  ctx.strokeStyle = color('--clip-border');
  ctx.strokeRect(inset + 0.5, top + 0.5, clipWidth - 1, bottom - top);
  ctx.fillStyle = color('--muted');
  ctx.font = '10px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const divisions = width > 470 ? 8 : 4;
  ctx.strokeStyle = color('--grid');
  ctx.beginPath();
  for (let index = 0; index <= divisions; index++) {
    const x = inset + index / divisions * clipWidth;
    const elapsed = duration * index / divisions;
    const label = timeLabel(elapsed, duration < divisions);
    ctx.moveTo(x + 0.5, top + labelHeight);
    ctx.lineTo(x + 0.5, bottom);
    const textX = Math.min(width - inset - ctx.measureText(label).width, x + 2);
    ctx.fillText(label, textX, 9);
  }
  ctx.moveTo(inset, waveMid + 0.5);
  ctx.lineTo(width - inset, waveMid + 0.5);
  ctx.stroke();
  const step = clipWidth / session.waveform.length;
  ctx.strokeStyle = color('--wave');
  ctx.beginPath();
  session.waveform.forEach(({ min, max }, index) => {
    const x = inset + (index + 0.5) * step;
    ctx.moveTo(x, waveMid - max * waveHeight);
    ctx.lineTo(x, waveMid - min * waveHeight);
  });
  ctx.stroke();
  const playhead = inset + Math.min(1, audio.currentTime / (duration || 1)) * clipWidth;
  ctx.strokeStyle = color('--accent');
  ctx.beginPath();
  ctx.moveTo(playhead + 0.5, top);
  ctx.lineTo(playhead + 0.5, bottom);
  ctx.stroke();
}

/** @param {string} message @param {boolean} [error] */
function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function showStorage() {
  control('source-bytes', 'dd').textContent = bytesLabel(session?.mode === 'mock' ? undefined : session?.source.bytes);
  control('output-bytes', 'dd').textContent = bytesLabel(report?.outputBytes);
  control('cache-bytes', 'dd').textContent = bytesLabel(report?.cacheBytes);
  control('project-bytes', 'dd').textContent = bytesLabel(report?.projectBytes);
}

/** @param {Operation} operation */
function operationTitle(operation) {
  return operation.type === 'reverse' ? 'Reverse' : 'Gain';
}

/** @param {Operation} operation */
function stepStats(operation) {
  const step = report?.steps.find((item) => item.operationId === operation.id);
  if (!operation.enabled) return 'Bypassed';
  if (!step) return 'Pending render';
  if (step.status === 'hit') return `Hit · ${step.lookupMs.toFixed(2)} ms lookup`;
  return `Miss · ${step.renderMs.toFixed(2)} ms render`;
}

function showDevices() {
  const oldScroll = devices.scrollLeft;
  const focused = document.activeElement instanceof HTMLButtonElement
    ? document.activeElement.dataset.control
    : undefined;
  devices.replaceChildren();
  if (!operations.length) {
    const empty = document.createElement('li');
    empty.className = 'chain-empty';
    empty.textContent = 'Source only. Add Reverse or Gain to process.';
    devices.append(empty);
  }
  operations.forEach((operation) => {
    const fragment = /** @type {DocumentFragment} */ (deviceTemplate.content.cloneNode(true));
    const device = /** @type {HTMLLIElement} */ (fragment.querySelector('.device'));
    const on = /** @type {HTMLButtonElement} */ (fragment.querySelector('.device-on'));
    const select = /** @type {HTMLButtonElement} */ (fragment.querySelector('.device-select'));
    const remove = /** @type {HTMLButtonElement} */ (fragment.querySelector('.device-remove'));
    const title = operationTitle(operation);
    const isSelected = selected === operation.id;
    device.classList.toggle('selected', isSelected);
    device.classList.toggle('bypassed', !operation.enabled);
    on.dataset.control = `on:${operation.id}`;
    on.textContent = operation.enabled ? 'ON' : 'OFF';
    on.setAttribute('aria-label', `Enable ${title}`);
    on.setAttribute('aria-pressed', String(operation.enabled));
    on.disabled = resultOnly;
    on.onclick = () => {
      operation.enabled = !operation.enabled;
      invalidate();
      showDevices();
    };
    select.dataset.control = `select:${operation.id}`;
    select.textContent = title;
    select.setAttribute('aria-pressed', String(isSelected));
    select.onclick = () => {
      selected = operation.id;
      showDevices();
    };
    remove.dataset.control = `remove:${operation.id}`;
    remove.setAttribute('aria-label', `Remove ${title}`);
    remove.disabled = resultOnly;
    remove.onclick = () => {
      const removedIndex = operations.indexOf(operation);
      operations.splice(removedIndex, 1);
      if (isSelected) {
        selected = (operations[removedIndex] ?? operations.at(-1))?.id ?? null;
      }
      invalidate();
      showDevices();
      const nextControl = [...devices.querySelectorAll('button.device-select')]
        .find((button) => button instanceof HTMLButtonElement && button.dataset.control === `select:${selected}`);
      if (nextControl instanceof HTMLButtonElement) nextControl.focus();
      else addReverse.focus();
    };
    const parameter = device.querySelector('.device-parameter');
    const stats = device.querySelector('.device-stats');
    if (parameter && stats) {
      parameter.textContent = operation.type === 'gain' ? gainLabel(operation.db) : 'Whole clip';
      const step = report?.steps.find((item) => item.operationId === operation.id);
      const stateLabel = stepStats(operation);
      stats.textContent = step && step.status !== 'bypassed' ? `${stateLabel} · ${bytesLabel(step.bytes)}` : stateLabel;
      if (step?.status === 'hit') stats.setAttribute('title', `Cached artifact originally rendered in ${step.renderMs.toFixed(2)} ms`);
    }
    devices.append(fragment);
  });
  devices.scrollLeft = oldScroll;
  if (focused) {
    [...devices.querySelectorAll('button')].find((button) => button.dataset.control === focused)?.focus({ preventScroll: true });
  }
  const active = operations.find((operation) => operation.id === selected);
  inspector.textContent = active ? operationTitle(active) : 'Parameters';
  gainPanel.hidden = active?.type !== 'gain';
  gain.disabled = resultOnly || !active?.enabled;
  deviceDescription.hidden = active?.type === 'gain' && active.enabled;
  deviceDescription.textContent = !active ? 'Select an operation.' : active.enabled ? 'Enabled · reverse frame order' : 'Bypassed';
  if (active?.type === 'gain') {
    gain.value = String(active.db);
    gainValue.value = gainLabel(active.db);
    gain.setAttribute('aria-valuetext', gainLabel(active.db));
  }
}

function setAudition() {
  const sourceAudio = session?.sourceAudio;
  outputOption.disabled = !outputAudio;
  if (!outputAudio) audioTarget.value = 'source';
  const target = audioTarget.value === 'output' ? outputAudio : sourceAudio;
  audioTarget.disabled = !outputAudio;
  audition.disabled = !target;
  audition.title = target ? '' : 'Audition is available in the engine preview.';
  if (target !== audio.getAttribute('src')) {
    audio.pause();
    if (target) audio.setAttribute('src', target);
    else audio.removeAttribute('src');
    audio.load();
  }
  updateTransport();
}

function updateTransport() {
  audition.textContent = audio.paused ? 'Play' : 'Pause';
  control('playback-time', 'output').value = timeLabel(audio.currentTime, true);
  drawWaveform();
}

function trackPlayhead() {
  updateTransport();
  if (!audio.paused) animationFrame = requestAnimationFrame(trackPlayhead);
}

/** @param {string} id */
function stopOnServer(id) {
  void fetch(`/api/render/${id}`, { method: 'DELETE' }).catch(() => {});
}

/** @param {string} message */
function cancelRender(message) {
  if (!activeRender) return;
  const { id, controller } = activeRender;
  activeRender = null;
  controller.abort();
  stopOnServer(id);
  renderButton.disabled = false;
  cancelButton.disabled = true;
  progress.hidden = true;
  showStatus(message);
}

function invalidate() {
  cancelRender('Previous render superseded');
  report = undefined;
  outputAudio = undefined;
  showStorage();
  setAudition();
  showStatus(session?.mode === 'mock' ? 'Mock data · edit the chain to preview controls' : 'Chain edited · ready to render');
}

/** @param {Operation['type']} type */
function addOperation(type) {
  const base = { id: newId(), enabled: true };
  const operation = type === 'reverse' ? { ...base, type } : { ...base, type, db: DEFAULT_GAIN };
  operations.push(operation);
  selected = operation.id;
  invalidate();
  showDevices();
  devices.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** @param {ModalResult} result */
function sendToLive(result) {
  const message = { method: 'close_and_send', params: [JSON.stringify(result)] };
  const host = /** @type {Window & {
   *   webkit?: { messageHandlers?: { live?: { postMessage(message: unknown): void } } },
   *   chrome?: { webview?: { postMessage(message: unknown): void } }
   * }} */ (window);
  const handler = host.webkit?.messageHandlers?.live ?? host.chrome?.webview;
  if (!handler) {
    showStatus('Live Webview message handler unavailable', true);
    return;
  }
  handler.postMessage(message);
}

function selectedTheme() {
  return theme.value === 'light' ? 'light' : 'dark';
}

/**
 * @param {RequestInfo | URL} path
 * @param {RequestInit} [options]
 */
async function readJson(path, options) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `Request failed (${response.status})`);
  return payload;
}

async function render() {
  if (!session || activeRender) return;
  /** @type {OperationPlan} */
  const plan = { version: 1, operations: operations.map((operation) => ({ ...operation })) };
  if (session.mode === 'live') {
    sendToLive(resultOnly ? { action: 'close' } : { action: 'render', plan, theme: selectedTheme() });
    return;
  }
  if (session.mode === 'mock') {
    showStatus(`Mock plan ready · ${operations.length} operation${operations.length === 1 ? '' : 's'}`);
    return;
  }

  const id = newId();
  const controller = new AbortController();
  activeRender = { id, controller };
  progress.hidden = false;
  progress.removeAttribute('value');
  renderButton.disabled = true;
  cancelButton.disabled = false;
  showStatus('Rendering…');
  const path = `/api/render/${id}`;
  const { signal } = controller;
  try {
    /** @type {RenderState} */
    let state = await readJson(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
      signal,
    });
    while (activeRender?.id === id && state.state === 'rendering') {
      if (state.progress) {
        progress.value = state.progress.fraction;
        showStatus(`Rendering · ${state.progress.completed}/${state.progress.total} operations`);
      }
      await new Promise((resolve) => setTimeout(resolve, 65));
      if (activeRender?.id !== id) return;
      state = await readJson(path, { signal });
    }
    if (activeRender?.id !== id) return;
    if (state.state === 'error') throw new Error(state.message);
    if (state.state === 'cancelled') showStatus('Render cancelled');
    if (state.state === 'complete') {
      audioTarget.value = 'source';
      report = state.report;
      outputAudio = state.outputAudio;
      outputOption.disabled = false;
      audioTarget.value = 'output';
      showStorage();
      showDevices();
      setAudition();
      showStatus('Render complete');
    }
  } catch (error) {
    if (activeRender?.id === id) showStatus(error instanceof Error ? error.message : 'Render failed', true);
  } finally {
    if (activeRender?.id === id) {
      activeRender = null;
      progress.hidden = true;
      renderButton.disabled = false;
      cancelButton.disabled = true;
    }
  }
}

async function start() {
  const liveData = document.getElementById('live-session');
  const initial = /** @type {EditorSession} */ (
    liveData ? JSON.parse(liveData.textContent ?? '') : await readJson('/api/session')
  );
  session = initial;
  operations = initial.operations.map((operation) => ({ ...operation }));
  report = initial.report;
  resultOnly = initial.mode === 'live' && Boolean(report);
  theme.value = initial.theme ?? 'dark';
  document.documentElement.dataset.theme = theme.value;
  selected = operations.at(-1)?.id ?? null;
  if (initial.mode === 'mock') {
    const mode = control('mode-label', 'span');
    mode.textContent = 'Mock data';
    mode.hidden = false;
  }
  const format = initial.source.format;
  control('metadata', 'span').textContent = `${timeLabel(format.durationSeconds, true)} · ${format.sampleRate / 1000} kHz · ${format.bitDepth}-bit ${format.encoding.toUpperCase()} · ${format.channels === 1 ? 'Mono' : 'Stereo'}`;
  control('clip-name', 'span').textContent = initial.source.name;
  addReverse.disabled = resultOnly;
  addGain.disabled = resultOnly;
  renderButton.disabled = false;
  cancelButton.disabled = initial.mode !== 'live';
  if (initial.mode === 'mock') renderButton.textContent = 'Submit plan';
  if (resultOnly) {
    renderButton.textContent = 'Done';
    cancelButton.textContent = 'Edit chain';
  }
  showStatus(resultOnly ? 'Render complete' : initial.mode === 'mock' ? 'Mock data · edit the chain to preview controls' : 'Ready to render');
  showStorage();
  showDevices();
  setAudition();
  new ResizeObserver(drawWaveform).observe(timeline);
}

addReverse.onclick = () => addOperation('reverse');
addGain.onclick = () => addOperation('gain');
gain.oninput = () => {
  const operation = operations.find((item) => item.id === selected);
  if (operation?.type !== 'gain') return;
  operation.db = gain.valueAsNumber;
  invalidate();
  showDevices();
};
theme.onchange = () => {
  document.documentElement.dataset.theme = theme.value;
  drawWaveform();
};
renderButton.onclick = () => void render();
cancelButton.onclick = () => {
  if (session?.mode === 'live') {
    sendToLive(resultOnly ? { action: 'edit', theme: selectedTheme() } : { action: 'cancel' });
  } else {
    cancelRender('Render cancelled');
  }
};
audioTarget.onchange = setAudition;
audition.onclick = () => {
  if (audio.paused) {
    void audio.play().catch(() => showStatus('Audition audio unavailable', true));
  } else {
    audio.pause();
  }
};
audio.onplay = trackPlayhead;
audio.onpause = audio.onended = () => {
  cancelAnimationFrame(animationFrame);
  updateTransport();
};
void start().catch((error) => showStatus(error instanceof Error ? error.message : 'Source could not be loaded', true));
