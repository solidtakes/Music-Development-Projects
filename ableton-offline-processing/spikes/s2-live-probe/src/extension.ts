/**
 * AOPX S2 read-only Live diagnostic, Issue #40.
 * Each AudioClip handle is resolved on demand. No SDK model setter is called.
 */
import {
  AudioClip, AudioTrack, ClipSlot, TakeLane, initialize,
  type ActivationContext, type Handle,
} from "@ableton-extensions/sdk";
import { snapshotClip, type ClipScope } from "./snapshot.ts";

export function activate(activation: ActivationContext): void {
  const context = initialize(activation, "1.0.0");
  console.log("[AOPX S2] active; inspect clips via AudioClip context menu (READ-ONLY).");
  context.commands.registerCommand("aopx.s2.inspect-clip", (argument: unknown) => {
    const report: Record<string, unknown> = {
      probe: "aopx-s2-live", version: 1, capturedAt: new Date().toISOString(),
    };
    try {
      if (!argument || typeof argument !== "object" || !("id" in argument)) {
        throw new TypeError("Missing AudioClip handle");
      }
      const clip = context.getObjectFromHandle(argument as Handle, AudioClip);
      const parent = clip.parent;
      let track: InstanceType<typeof AudioTrack> | null = null;
      let scope: ClipScope = "Unknown";
      if (parent instanceof AudioTrack) {
        track = parent; scope = "Arrangement";
      } else if (parent instanceof TakeLane) {
        scope = "TakeLane";
        if (parent.parent instanceof AudioTrack) track = parent.parent;
      } else if (parent instanceof ClipSlot) {
        scope = "Session";
        if (parent.parent instanceof AudioTrack) track = parent.parent;
      }
      const song = context.application.song;
      const idx = track
        ? song.tracks.findIndex(candidate => candidate.handle.id === track!.handle.id)
        : -1;
      report.result = snapshotClip(clip, track, scope, idx >= 0 ? idx : null, song.tempo);
      report.outcome = "OK";
    } catch (error) {
      report.outcome = "BLOCKED";
      // Raw SDK error messages may contain user paths or clip names; omit them.
      report.errorType = error instanceof Error ? error.name : "Unknown";
      console.log("[AOPX S2] inspection failed; no Set mutation attempted.");
    }
    console.log("AOPX_S2_RESULTS_BEGIN");
    console.log(JSON.stringify(report));
    console.log("AOPX_S2_RESULTS_END");
  });
  void context.ui.registerContextMenuAction(
    "AudioClip", "AOPX S2 inspect audio clip (read-only)", "aopx.s2.inspect-clip",
  );
}
