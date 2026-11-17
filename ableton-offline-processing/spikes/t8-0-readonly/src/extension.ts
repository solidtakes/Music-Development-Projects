/**
 * Disposable Windows Live 13 Beta probe. NO Set writes; no import, track or clip creation.
 * Only the official read-only S2 and S4 SDK calls and proven S3 showModalDialog.
 */
import {
  AudioClip,
  AudioTrack,
  initialize,
  type ActivationContext,
  type Handle,
} from "@ableton-extensions/sdk";
import { readFile, stat } from "node:fs/promises";
import editorHtml from "./interface.html";
import { runReadOnlyFlow, type ReadOnlyPort, type ResolvedClip } from "./flow.ts";

export function activate(activation: ActivationContext): void {
  const context = initialize(activation, "1.0.0");
  console.log("[AOPX T8-0] READ-ONLY prototype active. No Live Set edits are possible.");
  type Track = InstanceType<typeof AudioTrack>; // SDK beta.1 AudioTrack is version-generic.
  let busy = false;

  const port: ReadOnlyPort<Track> = {
    async resolveClip(argument: unknown): Promise<ResolvedClip<Track>> {
      if (!argument || typeof argument !== "object" || !("id" in argument)) {
        throw new TypeError("Missing AudioClip handle");
      }
      const clip = context.getObjectFromHandle(argument as Handle, AudioClip);
      const parent = clip.parent;
      if (!(parent instanceof AudioTrack)) {
        return {
          scope: "Other", track: null, trackIndex: null,
          startBeat: clip.startTime, endBeat: clip.endTime, overlappingClipCount: null,
        };
      }
      const track = parent;
      const idx = context.application.song.tracks.findIndex(
        candidate => candidate.handle.id === track.handle.id,
      );
      const overlapping = track.arrangementClips.filter(other =>
        other.handle.id !== clip.handle.id &&
        Number.isFinite(other.startTime) && Number.isFinite(other.endTime) &&
        other.startTime < clip.endTime && clip.startTime < other.endTime,
      ).length;
      return {
        scope: "Arrangement", track, trackIndex: idx >= 0 ? idx : null,
        startBeat: clip.startTime, endBeat: clip.endTime,
        overlappingClipCount: overlapping,
      };
    },
    renderPreFx: (track, start, end) =>
      context.resources.renderPreFxAudio(track, start, end),
    async readRenderedWav(path, maxBytes) {
      // The path is supplied directly by the Live renderer, never from a user/modal response.
      const s = await stat(path);
      if (!s.isFile() || s.size <= 0 || s.size > maxBytes) throw new RangeError("Render file size outside read-only test cap");
      return readFile(path);
    },
    showModal: (url, width, height) => context.ui.showModalDialog(url, width, height),
    log: line => console.log(line),
  };

  context.commands.registerCommand("aopx.t8-0.read-only", async (arg: unknown) => {
    if (busy) {
      console.log("[AOPX T8-0] Another read-only test is already running.");
      return;
    }
    busy = true;
    try {
      await runReadOnlyFlow(port, arg, editorHtml);
    } finally {
      busy = false;
    }
  });
  void context.ui.registerContextMenuAction(
    "AudioClip",
    "AOPX T8-0 Preview (READ-ONLY — does not save)",
    "aopx.t8-0.read-only",
  );
}
