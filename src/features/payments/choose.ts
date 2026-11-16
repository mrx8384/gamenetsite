/** Pure choice of the active gateway (unit-tested). `setting` undefined = admin never chose (use .env); null/"disabled" = off. */
export function chooseActiveKey(setting: string | null | undefined, envDefault: string, configured: string[]): string | null {
  const key = setting === undefined ? envDefault : setting;
  return key && key !== "disabled" && configured.includes(key) ? key : null;
}
