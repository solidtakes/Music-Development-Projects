// Handwritten minimum mock surface for OFFLINE typechecking. Not Ableton SDK source.
export interface Handle { id: bigint }
export interface ActivationContext { readonly offlineMock?: true }
export class Obj<V = '1.0.0'> { handle: Handle; parent: Obj<V> | null }
export class Clip<V = '1.0.0'> extends Obj<V> {
  name: string; startTime: number; endTime: number; duration: number;
  startMarker: number; endMarker: number; loopStart: number; loopEnd: number;
  muted: boolean; looping: boolean;
}
export class AudioClip<V = '1.0.0'> extends Clip<V> {
  readonly filePath: string; warping: boolean; warpMode: number;
}
export class Track<V = '1.0.0'> extends Obj<V> {
  name: string; mute: boolean; solo: boolean; arm: boolean; groupTrack: Track<V> | null;
  arrangementClips: Clip<V>[]; clipSlots: { clip: Clip<V> | null }[];
  takeLanes: unknown[]; devices: unknown[];
}
export class AudioTrack<V = '1.0.0'> extends Track<V> {
  createAudioClip(args: { filePath: string; startTime: number; isWarped?: boolean; duration?: number }): Promise<AudioClip<V>>;
}
export interface ExtensionContext<V = '1.0.0'> {
  application: { song: Obj<V> & { tempo: number; tracks: Track<V>[] } };
  environment: { tempDirectory: string | undefined; storageDirectory: string | undefined };
  getObjectFromHandle<T>(handle: Handle, type: abstract new (...args: never[]) => T): T;
  resources: {
    renderPreFxAudio(track: AudioTrack<V>, start: number, end: number): Promise<string>;
    importIntoProject(path: string): Promise<string>;
  };
  ui: { showModalDialog(url: string, width: number, height: number): Promise<string>;
    registerContextMenuAction(scope: 'AudioClip', label: string, command: string): Promise<() => Promise<void>> };
  commands: { registerCommand(command: string, callback: (...args: unknown[]) => void): void };
}
export function initialize(activation: ActivationContext, version: '1.0.0'): ExtensionContext<'1.0.0'>;
