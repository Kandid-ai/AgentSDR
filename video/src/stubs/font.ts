/**
 * next/font/google outside Next, where its compile-time transform never runs.
 * The video loads the same faces itself (src/fonts.ts) under the same CSS
 * variables, so a font object here only has to be inert.
 */
type FontOptions = { variable?: string };
const font = (options: FontOptions = {}) => ({ className: "", variable: "", style: { fontFamily: options.variable ? `var(${options.variable})` : "inherit" } });

export const Geist = font;
export const Geist_Mono = font;
export const Inter = font;
export const Caveat = font;
export const Instrument_Serif = font;
