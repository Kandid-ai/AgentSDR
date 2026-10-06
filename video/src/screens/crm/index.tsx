import type { ComponentType } from "react";
import { Actions, Pipeline } from "./Screens";

/** The crm screens the film shows, by name. Each is a real app screen on sample data. */
export const SCREENS: Record<string, ComponentType> = {
  actions: Actions,
  pipeline: Pipeline,
};
