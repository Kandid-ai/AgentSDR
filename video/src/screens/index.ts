import type { ComponentType } from "react";
import { SCREENS as CRM } from "./crm";
import { SCREENS as LEADS } from "./leads";
import { SCREENS as OUTREACH } from "./outreach";

/** Every real screen the film shows, by name (see each area's index). */
export const SCREENS: Record<string, ComponentType> = { ...LEADS, ...OUTREACH, ...CRM };
