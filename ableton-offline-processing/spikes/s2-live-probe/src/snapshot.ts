import { extname } from "node:path";

/** SDK-independent snapshot; no paths, names or handle IDs in the output. */
export interface ClipView {
  handle: { id: bigint };
  startTime: number; endTime: number; duration: number;
  startMarker: number; endMarker: number; loopStart: number; loopEnd: number;
  looping: boolean; muted: boolean; warping: boolean;
  warpMode: number | string; warpMarkers: readonly unknown[];
  filePath: string;
}
export interface TrackView {
  handle: { id: bigint };
  arrangementClips: ReadonlyArray<{
    handle: { id: bigint }; startTime: number; endTime: number;
  }>;
}
export type ClipScope = "Arrangement" | "TakeLane" | "Session" | "Unknown";
export function snapshotClip(
  clip: ClipView, track: TrackView | null, scope: ClipScope,
  trackIndex: number | null, tempoBpm: number,
) {
  const overlapCount = scope === "Arrangement" && track
    ? track.arrangementClips.filter(other =>
        other.handle.id !== clip.handle.id &&
        Number.isFinite(other.startTime) &&
        Number.isFinite(other.endTime) &&
        other.startTime < clip.endTime &&
        clip.startTime < other.endTime).length
    : null;
  return {
    schemaVersion: 1,
    scope,
    parentTrackResolved: track !== null,
    trackIndex,
    tempoBpm,
    timeUnits: "beats",
    clip: {
      startTime: clip.startTime, endTime: clip.endTime, duration: clip.duration,
      startMarker: clip.startMarker, endMarker: clip.endMarker,
      loopStart: clip.loopStart, loopEnd: clip.loopEnd,
      looping: clip.looping, muted: clip.muted, warping: clip.warping,
      warpMode: clip.warpMode, warpMarkerCount: clip.warpMarkers.length,
      sourceExtension: extname(clip.filePath).toLowerCase(),
    },
    overlap: {
      status: overlapCount === null ? "not-measured" : "measured",
      otherClipCount: overlapCount,
      overlapsOtherClips: overlapCount === null ? "unknown" : overlapCount > 0,
    },
    privacy: "no clip name, source path, or SDK handle IDs logged",
  };
}
