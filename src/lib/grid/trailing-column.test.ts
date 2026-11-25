import { expect, test } from "bun:test";
import { trailingColumnWidth } from "./trailing-column";

const maxScroll = (widths: number[], viewport: number, filler: number) =>
  Math.max(0, widths.reduce((a, b) => a + b, 0) + filler - viewport);

test("the scroll ends on a column boundary", () => {
  // The demo's Contacts sheet: eight 220px columns, 950px visible beside the pinned Name.
  const widths = Array(8).fill(220);
  const filler = trailingColumnWidth(widths, 950, 186);
  const end = maxScroll(widths, 950, filler);
  expect(end % 220).toBe(0);
  expect(filler).toBeGreaterThanOrEqual(186);
  // It used to end 116px into the fifth column, leaving its last 104px beside Name.
  expect(filler).toBe(186 + 104);
});

test("uneven widths still land on a boundary", () => {
  const widths = [90, 300, 220, 145, 400];
  const filler = trailingColumnWidth(widths, 600, 186);
  const end = maxScroll(widths, 600, filler);
  const boundaries = widths.reduce<number[]>((acc, w) => [...acc, (acc.at(-1) ?? 0) + w], [0]);
  expect(boundaries).toContain(end);
});

test("a scroll that already ends on a boundary keeps the minimum", () => {
  // 660 + 186 - 406 = 440, the end of the second column.
  expect(trailingColumnWidth([220, 220, 220], 406, 186)).toBe(186);
});

test("no horizontal scroll keeps the minimum", () => {
  expect(trailingColumnWidth([220, 220], 1000, 186)).toBe(186);
  expect(trailingColumnWidth([], 800, 186)).toBe(186);
  expect(trailingColumnWidth([220], 0, 186)).toBe(186);
});
