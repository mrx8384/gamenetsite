import path from "node:path";

/**
 * The PlayStation calibration tool (DualShock Calibration GUI, MIT — vendor/dualshock-tools) is served
 * from this folder by /gamepad-tools/…, only to users who may use the gamepad tester.
 */
export const TOOLS_ROOT = path.join(process.cwd(), "vendor", "dualshock-tools");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

/** Safe absolute path for a requested file, or null (unknown type, hidden file, or outside the folder). Pure. */
export function resolveToolFile(segments: string[]): { file: string; type: string } | null {
  if (segments.length === 0 || segments.length > 8) return null;
  if (segments.some((s) => !s || s === "." || s === ".." || s.startsWith(".") || /[\\/\0]/.test(s))) return null;
  const file = path.join(TOOLS_ROOT, ...segments);
  if (!file.startsWith(TOOLS_ROOT + path.sep)) return null;
  const type = TYPES[path.extname(file).toLowerCase()];
  return type ? { file, type } : null;
}
