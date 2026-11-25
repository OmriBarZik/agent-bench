import { toConfigRow } from "../runner/bench-config/bench-config";
import type { Selection } from "../runner/bench-config/bench-config.types";
import { currentSetupHash } from "../runner/setup-hash/setup-hash";
import type { CurrentSetup } from "./stale-runs.types";

/** The setup every task × config pair would run with today, once with chrome-validate and once without. */
export async function currentSetups(selection: Selection): Promise<CurrentSetup[]> {
  const setups: CurrentSetup[] = [];

  for (const config of selection.configs) {
    const { configHash } = await toConfigRow(config);

    for (const task of selection.tasks) {
      for (const autoReview of [true, false]) {
        const setupHash = currentSetupHash({ task, config, autoReview });
        setups.push({ taskId: task.taskId, configId: config.configId, autoReview, configHash, setupHash });
      }
    }
  }

  return setups;
}
