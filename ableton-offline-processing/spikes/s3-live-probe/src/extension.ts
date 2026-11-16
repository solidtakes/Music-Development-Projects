/*
 * AOPX S3 live probe, build 2: a throwaway, READ-ONLY Live extension (Issue #40).
 *
 * Wiring copied from the owner-verified SDK beta.1 `examples/modal-dialog` (Issue #40 comment
 * 6909553882): initialize(activation, "1.0.0"), context.commands.registerCommand,
 * context.ui.registerContextMenuAction("MidiClip" | "AudioClip", label, id) and
 * context.ui.showModalDialog(url, width, height). It does NOT call getObjectFromHandle or write to
 * any clip: right-clicking a clip is only the trigger. No render, import or Set edit. The GUI's
 * Apply result is checked with the product parser and only logged.
 */
import type { Handle } from "@ableton-extensions/sdk";
import { initialize, type ActivationContext } from "@ableton-extensions/sdk";
import { tmpdir } from "node:os";
import probeHtml from "./probe.html";
import guiHtml from "./interface.html";
import { parseModalResult } from "./product/host/src/modal.ts";
import { describeContext, runProbe } from "./probe-core.mjs";

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");
  // Observation, not assumption. Build 1 read this only here and found environment.tempDirectory
  // undefined; build 2 reads it again when the command runs (see runProbe readEnvironment).
  const atActivation = describeContext(context);
  console.log(`[AOPX S3] activated (probe build 2). Context description at activation: ${JSON.stringify(atActivation)}`);

  let running = false;
  const run = (mode: "core" | "full") => async (_handle: Handle) => {
    if (running) {
      console.log("[AOPX S3] a probe run is already in progress; ignored.");
      return;
    }
    running = true;
    try {
      let osTempDirectory: string | null = null;
      try { osTempDirectory = tmpdir(); } catch { osTempDirectory = null; }
      await runProbe({
        mode,
        showModalDialog: (url: string, width: number, height: number) => context.ui.showModalDialog(url, width, height),
        readEnvironment: () => describeContext(context),
        osTempDirectory,
        parseModalResult,
        log: (line: string) => console.log(line),
        probeHtml,
        guiHtml,
        environment: { node: process.version, platform: `${process.platform} ${process.arch}`, sdkApi: "1.0.0", contextAtActivation: atActivation },
      });
    } catch (e) {
      console.log(`[AOPX S3] probe run failed: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    } finally {
      running = false;
    }
  };

  context.commands.registerCommand("aopx.s3probe.core", (args: unknown) => run("core")(args as Handle));
  context.commands.registerCommand("aopx.s3probe.full", (args: unknown) => run("full")(args as Handle));
  (["MidiClip", "AudioClip"] as const).forEach((location) => {
    context.ui.registerContextMenuAction(location, "AOPX S3 probe build 2: core (read-only)", "aopx.s3probe.core");
    context.ui.registerContextMenuAction(location, "AOPX S3 probe build 2: full matrix (read-only)", "aopx.s3probe.full");
  });
}
