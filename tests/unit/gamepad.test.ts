import { describe, expect, it } from "vitest";
import { buttonLabel, circularity, controllerFamily, controllerModel, driftVerdict } from "@/features/gamepad-tester/analysis";

describe("gamepad tester analysis", () => {
  it("detects controller family and model from Gamepad.id", () => {
    expect(controllerFamily("DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)")).toBe("playstation");
    expect(controllerModel("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)")).toBe("DualSense (PS5)");
    expect(controllerModel("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)")).toBe("DualShock 4 (PS4)");
    expect(controllerModel("054c-0df2-DualSense Edge")).toBe("DualSense Edge");
    expect(controllerFamily("Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)")).toBe("xbox");
    expect(controllerFamily("8BitDo Pro 2")).toBe("generic");
  });
  it("labels standard-mapping buttons per family", () => {
    expect(buttonLabel("playstation", 0)).toBe("✕");
    expect(buttonLabel("playstation", 16)).toBe("PS");
    expect(buttonLabel("xbox", 3)).toBe("Y");
    expect(buttonLabel("generic", 5)).toBe("B5");
    expect(buttonLabel("playstation", 30)).toBe("B30");
  });
  it("classifies resting drift", () => {
    expect(driftVerdict(0.02)).toBe("excellent");
    expect(driftVerdict(0.08)).toBe("ok");
    expect(driftVerdict(0.2)).toBe("drift");
  });
  const ring = (r: number, step = 2, from = 0, to = 360) => {
    const pts = [];
    for (let a = from; a < to; a += step) pts.push({ x: r * Math.cos((a * Math.PI) / 180), y: r * Math.sin((a * Math.PI) / 180) });
    return pts;
  };
  it("full circle at full range → complete", () => {
    const r = circularity(ring(1));
    expect(r.verdict).toBe("complete");
    expect(r.coverage).toBe(1);
    expect(r.avgRadius).toBeGreaterThan(0.99);
  });
  it("half circle → incomplete; reduced range → weak", () => {
    expect(circularity(ring(1, 2, 0, 180)).verdict).toBe("incomplete");
    expect(circularity(ring(0.85)).verdict).toBe("weak");
  });
  it("ignores samples near the center", () => {
    expect(circularity(ring(0.2)).coverage).toBe(0);
  });
});
