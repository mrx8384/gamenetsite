import { useSyncExternalStore } from "react";
import { createStore } from "../store";
import { allPortals, portalMachineId } from "../world/registry";

export { machines, type MachineInfo, type MiniGameId } from "./machineData";
import { machines, type MachineInfo } from "./machineData";

/** Doorways between environments behave like a machine whose interaction is travelling. */
const portalMachines: Record<string, MachineInfo> = Object.fromEntries(
  allPortals().map((p) => [
    portalMachineId(p),
    { id: portalMachineId(p), name: p.prompt.replace(/^\S+\s/, ""), prompt: p.prompt, emoji: "🚪", description: "", photos: [], price: null, miniGame: null, travel: p.to, listed: false, noPrice: true },
  ]),
);

/** Every machine the world knows: the club's machines and the doorways of all environments. */
export const BASE_MACHINES: Record<string, MachineInfo> = { ...machines, ...portalMachines };

export type MachineId = keyof typeof machines;

/**
 * Live machine data: the local defaults above, with whatever the club saved in the site's admin
 * panel merged over them (see data/remoteMachines.ts). Starts with the local data, so the world
 * works the same when the site is unreachable.
 */
export const machineStore = createStore<{ byId: Record<string, MachineInfo> }>({ byId: { ...BASE_MACHINES } });

export function getMachine(id: string): MachineInfo | undefined {
  return machineStore.get().byId[id];
}

export function allMachines(): MachineInfo[] {
  return Object.values(machineStore.get().byId);
}

export function useMachines(): Record<string, MachineInfo> {
  return useSyncExternalStore(machineStore.subscribe, () => machineStore.get().byId, () => machineStore.get().byId);
}

export function useMachine(id: string): MachineInfo | undefined {
  return useMachines()[id];
}
