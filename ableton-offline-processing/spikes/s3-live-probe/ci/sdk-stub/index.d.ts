// Only what the verified modal-dialog example uses. Anything else fails the CI typecheck on purpose.
export type Handle = { readonly __handle: unique symbol };
export interface ActivationContext { readonly __activation: unique symbol }
export declare class Clip { name: string }
export declare class AudioClip extends Clip {}
export declare class MidiClip extends Clip {}
export interface ExtensionContext {
  commands: { registerCommand(id: string, callback: (args: unknown) => unknown): void };
  ui: {
    showModalDialog(url: string, width: number, height: number): Promise<string | undefined | null>;
    registerContextMenuAction(location: "MidiClip" | "AudioClip", label: string, commandId: string): void;
  };
  getObjectFromHandle<T>(handle: Handle, type: abstract new (...args: never[]) => T): T;
}
export declare function initialize(activation: ActivationContext, apiVersion: string): ExtensionContext;
