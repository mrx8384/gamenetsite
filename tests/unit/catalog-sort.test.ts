import { describe, expect, it } from "vitest";
import { sortCatalogGames } from "@/features/game-catalog/sort";

const g = (name: string, position: number) => ({ name, position });
const games = [g("FIFA 23", 1), g("assassin's Creed", 2), g("Call of Duty", 3), g("FIFA 3", 4), g("فوتبال", 5), g("Zelda", 6)];

describe("catalog sort", () => {
  it("A to Z ignores case, orders numbers numerically, Persian names after Latin", () => {
    expect(sortCatalogGames(games, "az").map((x) => x.name)).toEqual(["assassin's Creed", "Call of Duty", "FIFA 3", "FIFA 23", "Zelda", "فوتبال"]);
  });
  it("newest = last added first; category = original order; input untouched", () => {
    expect(sortCatalogGames(games, "newest").map((x) => x.position)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(sortCatalogGames([...games].reverse(), "category").map((x) => x.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(games[0].name).toBe("FIFA 23");
  });
});
