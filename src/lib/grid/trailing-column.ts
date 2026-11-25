/**
 * The width of the grid's trailing "Add column" filler.
 *
 * Pinned columns are sticky: the scrolled columns slide underneath them. With a
 * fixed-width filler the horizontal scroll ended wherever the sum of widths
 * happened to land — usually part-way through a column, so the right-hand
 * sliver of that column (its menu chevron, with its label and values hidden
 * under the pinned column) sat beside the pinned column as an empty,
 * header-less column. Widening the filler just enough makes the scroll end on a
 * column boundary instead.
 *
 * `centerWidths` are the scrolling (unpinned) columns before the filler, in
 * display order; `viewportWidth` is the visible width of the scrolling area.
 */
export function trailingColumnWidth(centerWidths: number[], viewportWidth: number, minWidth: number): number {
  const content = centerWidths.reduce((sum, width) => sum + width, 0);
  // How far the grid scrolls with the narrowest filler.
  const overflow = content + minWidth - viewportWidth;
  if (overflow <= 0 || viewportWidth <= 0) return minWidth;
  // The first column boundary at or past that point becomes the end of the scroll.
  let boundary = 0;
  for (const width of centerWidths) {
    if (boundary >= overflow) break;
    boundary += width;
  }
  return Math.max(minWidth, Math.round(boundary + viewportWidth - content));
}
