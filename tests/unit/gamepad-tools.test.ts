import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolveToolFile } from "@/features/gamepad-tester/tools-files";
import { pictureModel } from "@/components/gamepad-tester/controller-picture";

describe("gamepad tools files", () => {
  it("serves only known file types inside the tool folder", () => {
    expect(resolveToolFile(["index.html"])?.type).toMatch(/text\/html/);
    expect(resolveToolFile(["js", "core.js"])?.type).toMatch(/javascript/);
    expect(resolveToolFile([".."])).toBeNull();
    expect(resolveToolFile(["..", "..", ".env"])).toBeNull();
    expect(resolveToolFile(["js", "..", "..", "package.json"])).toBeNull();
    expect(resolveToolFile(["a/b.js"])).toBeNull();
    expect(resolveToolFile([".git", "config"])).toBeNull();
    expect(resolveToolFile(["Dockerfile"])).toBeNull();
    expect(resolveToolFile([])).toBeNull();
  });
  it("vendored tool sends nothing outside the site", () => {
    const html = readFileSync("vendor/dualshock-tools/index.html", "utf8");
    expect(html).not.toMatch(/googletagmanager|cdn\.jsdelivr|code\.jquery/);
    expect(readFileSync("vendor/dualshock-tools/js/utils.js", "utf8")).not.toMatch(/the\.al\/ds4_a/);
    expect(readFileSync("vendor/dualshock-tools/js/translations.js", "utf8")).not.toMatch(/cdn\.jsdelivr/);
    for (const f of ["lib/jquery.min.js", "lib/bootstrap/bootstrap.rtl.min.css", "lib/bootstrap/bootstrap.bundle.min.js", "lib/fontawesome/css/all.min.css", "LICENSE.txt"]) {
      expect(existsSync(`vendor/dualshock-tools/${f}`)).toBe(true);
    }
  });
  it("picks the drawing from the controller id", () => {
    expect(pictureModel("playstation", "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)")).toBe("dualsense");
    expect(pictureModel("playstation", "Wireless Controller (Vendor: 054c Product: 09cc)")).toBe("dualshock4");
    expect(pictureModel("playstation", "DualSense Edge (Vendor: 054c Product: 0df2)")).toBe("dualsense-edge");
    expect(pictureModel("xbox", "Xbox Wireless Controller (Vendor: 045e)")).toBe("xbox");
    expect(pictureModel("generic", "USB Gamepad")).toBe("xbox");
  });
});
