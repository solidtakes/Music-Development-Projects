import { AudioClip, AudioTrack, initialize, type ActivationContext, type Handle } from "@ableton-extensions/sdk";
import { runRoundTrip } from "./round-trip.js";

export async function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");
  const command = "aopx.spike.roundTrip";
  let running = false;

  context.commands.registerCommand(command, async (clicked: unknown) => {
    if (running) throw new Error("An AOPX round-trip test is already running.");
    running = true;
    try {
      await runRoundTrip(context, () => context.getObjectFromHandle(clicked as Handle, AudioClip), AudioTrack);
    } catch (error) {
      console.error("[AOPX-01] Round-trip test failed", error);
      throw error;
    } finally {
      running = false;
    }
  });

  await context.ui.registerContextMenuAction("AudioClip", "AOPX · Test isolated clip round-trip", command);
}
