import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./src/webpack";

/**
 * video/public/landing is a symlink to the app's public/landing, so the
 * landing page's tool logos are on hand without the video's own assets (the
 * music) ever being served by the app.
 */
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.overrideWebpackConfig(webpackOverride);
