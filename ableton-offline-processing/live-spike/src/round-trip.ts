import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import type { AudioClip, AudioTrack, ExtensionContext } from "@ableton-extensions/sdk";

type LiveContext = ExtensionContext<"1.0.0">;
type LiveClip = AudioClip<"1.0.0">;

function captureClip(clip: LiveClip, AudioTrackClass: typeof AudioTrack) {
  const track = clip.parent;
  if (!(track instanceof AudioTrackClass) || track.arrangementClips.length !== 1
      || track.arrangementClips[0] !== clip || track.takeLanes.length !== 0) {
    throw new Error("Use the only Arrangement clip on an audio track with no take lanes.");
  }

  const { startTime, endTime, muted, warping, looping } = clip;
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    throw new Error("The selected clip has no valid Arrangement beat range.");
  }
  if (muted || track.mute || track.mutedViaSolo || warping || looping) {
    throw new Error("Use an audible, unwarped, unlooped test clip.");
  }
  const metadata = {
    name: clip.name, startTime, endTime, duration: endTime - startTime,
    startMarker: clip.startMarker, endMarker: clip.endMarker,
    warping, warpMode: clip.warpMode, warpMarkerCount: clip.warpMarkers.length,
    looping, loopStart: clip.loopStart, loopEnd: clip.loopEnd,
  };
  return { track, metadata };
}

function checkTempWav(root: string, path: string) {
  const fromRoot = relative(root, path);
  if (!isAbsolute(path) || !fromRoot || fromRoot === ".."
      || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error("Live returned a render path outside the Extension temp directory.");
  }
  if (!/\.wav$/i.test(path)) throw new Error("Set the beta's Record File Type to WAV and retry.");
}

function inspectRender(bytes: Buffer) {
  if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "RIFF"
      || bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Live returned a file without a RIFF/WAVE header.");
  }
  const end = 8 + bytes.readUInt32LE(4);
  if (end > bytes.length) throw new Error("The rendered WAV is truncated.");
  let format;
  let dataSize;
  for (let chunk = 12; chunk + 8 <= end;) {
    const name = bytes.toString("ascii", chunk, chunk + 4);
    const size = bytes.readUInt32LE(chunk + 4);
    const payload = chunk + 8;
    const nextChunk = payload + size + (size % 2);
    if (nextChunk > end) throw new Error("The rendered WAV has a truncated chunk.");
    if (name === "fmt " && size >= 16) {
      format = {
        formatTag: bytes.readUInt16LE(payload), channels: bytes.readUInt16LE(payload + 2),
        sampleRate: bytes.readUInt32LE(payload + 4), blockAlign: bytes.readUInt16LE(payload + 12),
        bitDepth: bytes.readUInt16LE(payload + 14),
      };
    }
    if (name === "data") dataSize = size;
    chunk = nextChunk;
  }
  if (!format?.channels || !format.sampleRate || !format.blockAlign || !dataSize
      || dataSize % format.blockAlign) {
    throw new Error("The rendered WAV has no usable format or complete audio frames.");
  }
  const frames = dataSize / format.blockAlign;
  return {
    ...format, frames, seconds: frames / format.sampleRate, bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function confirmationUrl(metadata: ReturnType<typeof captureClip>["metadata"], render: ReturnType<typeof inspectRender>) {
  const summary = `${render.frames} frames · ${render.channels} channels · ${render.sampleRate} Hz · ${render.bitDepth}-bit`;
  return `data:text/html,${encodeURIComponent(`<!doctype html>
<html lang="en"><meta charset="utf-8"><title>AOPX isolated-clip test</title>
<body><h1>Isolated clip round-trip</h1><p>${summary}</p>
<p>Arrangement beat ${metadata.startTime}, length ${metadata.duration} beats.</p>
<p>Import the pre-FX WAV on a new track in this disposable Set.</p>
<button id="cancel" autofocus>Cancel</button><button id="import">Import copy</button>
<script type="module">
  function close(result) {
    const host = window.chrome?.webview ?? window.webkit?.messageHandlers?.live;
    host?.postMessage({ method: "close_and_send", params: [result] });
  }
  document.querySelector("#cancel").onclick = () => close("cancel");
  document.querySelector("#import").onclick = () => close("import");
</script></body></html>`)}`;
}

export async function runRoundTrip(
  context: LiveContext,
  resolveClip: () => LiveClip,
  AudioTrackClass: typeof AudioTrack,
  log = console.log,
) {
  const { application, environment, resources, ui } = context;
  const song = application.song;
  const clip = resolveClip();
  const { track, metadata } = captureClip(clip, AudioTrackClass);

  let rendered: { path: string; render: ReturnType<typeof inspectRender> } | undefined;
  await ui.withinProgressDialog("Rendering isolated clip pre-FX", { progress: 0 },
    async (update, signal) => {
      await update("Rendering Arrangement range", 10);
      if (signal.aborted) return;
      const path = await resources.renderPreFxAudio(track, metadata.startTime, metadata.endTime);
      if (signal.aborted) return;
      checkTempWav(environment.tempDirectory, path);
      const render = inspectRender(await readFile(path));
      await update("WAV inspected", 100);
      if (!signal.aborted) rendered = { path, render };
    });
  if (!rendered) return { status: "cancelled" };

  log("[AOPX-01] Source and pre-FX WAV", { ...metadata, ...rendered.render });
  const result = await ui.showModalDialog(confirmationUrl(metadata, rendered.render), 420, 220);
  if (result !== "import") return { status: "cancelled" };

  function checkSource() {
    if (application.song !== song) throw new Error("The active Set changed. Run the test again.");
    const currentClip = resolveClip();
    if (currentClip !== clip) throw new Error("The source clip changed. Run the test again.");
    const current = captureClip(currentClip, AudioTrackClass);
    if (current.track !== track || JSON.stringify(current.metadata) !== JSON.stringify(metadata)) {
      throw new Error("The source clip changed. Run the test again.");
    }
  }

  checkSource();
  const imported = await resources.importIntoProject(rendered.path);
  checkSource();
  const outputTrack = await song.createAudioTrack();
  let output;
  try {
    checkSource();
    output = await outputTrack.createAudioClip({
      filePath: imported, startTime: metadata.startTime, duration: metadata.duration, isWarped: false,
    });
  } catch (error) {
    if (application.song === song && outputTrack.arrangementClips.length === 0
        && outputTrack.clipSlots.every(slot => !slot.clip)) {
      try {
        await song.deleteTrack(outputTrack);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Output clip creation and empty track cleanup both failed.");
      }
    }
    throw error;
  }

  const placement = { startTime: output.startTime, endTime: output.endTime, warping: output.warping, looping: output.looping };
  log("[AOPX-01] New Arrangement clip", placement);
  return { status: "imported", placement, render: rendered.render };
}
