import { AbsoluteFill } from "remotion";
import { FONT_VARS } from "../fonts";
import { SCREENS } from ".";

/**
 * A dev composition: one screen on the canvas, for checking a screen on its
 * own — `bunx remotion still src/index.ts Screen out/x.png --props='{"name":"pipeline"}'`.
 */
export function Preview({ name }: { name: string }) {
  const Screen = SCREENS[name];
  return (
    <AbsoluteFill style={{ ...FONT_VARS, background: "#f7f7f6", alignItems: "center", justifyContent: "center" }}>
      {Screen ? <div style={{ transform: "scale(1.25)" }}><Screen /></div> : <p style={{ fontSize: 40 }}>No screen named “{name}”. Known: {Object.keys(SCREENS).join(", ")}</p>}
    </AbsoluteFill>
  );
}
