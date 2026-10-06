// video.css first: the app's stylesheet must come last, so its responsive
// variants (md:block, lg:grid-cols-4) override the plain utilities both emit.
import "./video.css";
import "./style.css";
import { Composition, Still } from "remotion";
import { Film, FILM_FRAMES } from "./film/Film";
import { FPS } from "./kit/time";
import { Preview } from "./screens/Preview";
import { GALLERY, PH, PW, Thumbnail, ThumbnailAnimated, THUMB_LOOP } from "./ph/slides";

export function Root() {
  return (
    <>
      <Composition id="Launch" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={1920} height={1080} />
      <Composition id="Screen" component={Preview} durationInFrames={60} fps={FPS} width={1920} height={1080} defaultProps={{ name: "" }} />
      {/* Product Hunt: the gallery (tools/ph.ts renders them at 1270 × 760 and 2×) and the thumbnail. */}
      {GALLERY.map(({ id, component }) => (
        <Still key={id} id={`ph-${id}`} component={component} width={PW} height={PH} />
      ))}
      <Still id="ph-thumbnail" component={Thumbnail} width={480} height={480} />
      <Composition id="ph-thumbnail-animated" component={ThumbnailAnimated} durationInFrames={THUMB_LOOP * 2} fps={FPS} width={480} height={480} />
    </>
  );
}
