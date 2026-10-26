/**
 * Shared, mutable input state. Keyboard, mouse and touch controls write into it; the character
 * controller and camera read it every frame. Kept outside React so input never causes re-renders.
 */
export interface InputState {
  /** Movement axes in [-1, 1]: x = right, y = forward. */
  moveX: number;
  moveY: number;
  run: boolean;
  /** Edge-triggered flags, consumed by the reader. */
  jump: boolean;
  interact: boolean;
  /** Accumulated camera deltas in radians, consumed by the camera. */
  lookYaw: number;
  lookPitch: number;
  /** Accumulated zoom delta (positive = further), consumed by the camera. */
  zoom: number;
  /** Held keys for the camera (keyboard-only play): turn −1..1, zoom −1..1. */
  camTurn: number;
  camZoom: number;
}

export function createInput(): InputState {
  return { moveX: 0, moveY: 0, run: false, jump: false, interact: false, lookYaw: 0, lookPitch: 0, zoom: 0, camTurn: 0, camZoom: 0 };
}

/** Keyboard state → movement axes. */
export class KeyboardInput {
  private keys = new Set<string>();
  constructor(
    private input: InputState,
    private onMenu: () => void,
    private isBlocked: () => boolean,
    private onMap: () => void = () => {},
  ) {}

  attach() {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.clear);
  }

  detach() {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.clear);
    this.clear();
  }

  private down = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    // e.code is layout-independent, so W/A/S/D also work with a Persian keyboard layout.
    const code = e.code;
    if (code === "Escape") {
      this.onMenu();
      return;
    }
    if (this.isBlocked()) return;
    if (code === "Space") {
      if (!e.repeat) this.input.jump = true;
      e.preventDefault();
    }
    if (code === "KeyE" && !e.repeat) this.input.interact = true;
    if (code === "KeyM" && !e.repeat) this.onMap();
    if (/^(Arrow|Key[WASD]|Shift|Comma|Period|Minus|Equal)/.test(code)) e.preventDefault();
    this.keys.add(code);
    this.sync();
  };

  private up = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    this.sync();
  };

  private clear = () => {
    this.keys.clear();
    this.sync();
  };

  private sync() {
    const k = this.keys;
    const f = k.has("KeyW") || k.has("ArrowUp") ? 1 : 0;
    const b = k.has("KeyS") || k.has("ArrowDown") ? 1 : 0;
    const r = k.has("KeyD") || k.has("ArrowRight") ? 1 : 0;
    const l = k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0;
    this.input.moveY = f - b;
    this.input.moveX = r - l;
    this.input.run = k.has("ShiftLeft") || k.has("ShiftRight");
    // camera without a mouse: , . turn — - = zoom
    this.input.camTurn = (k.has("Period") ? 1 : 0) - (k.has("Comma") ? 1 : 0);
    this.input.camZoom = (k.has("Minus") ? 1 : 0) - (k.has("Equal") ? 1 : 0);
  }
}
