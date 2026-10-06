import type { ComponentType } from "react";
import { Leads } from "./Leads";
import { Workbook } from "./Workbook";
import { WorkbookEnriched, WorkbookEnrichCatalog, WorkbookRaw } from "./WorkbookStates";

/** The leads screens the film shows, by name. Each is a real app screen on sample data. */
export const SCREENS: Record<string, ComponentType> = {
  leads: Leads,
  workbook: Workbook,
  "workbook-raw": WorkbookRaw,
  "workbook-enriched": WorkbookEnriched,
  "workbook-enrich-catalog": WorkbookEnrichCatalog,
};
