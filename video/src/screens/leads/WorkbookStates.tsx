import { Drive, WorkbookFrame, click, pick } from "./WorkbookFrame";
import { ENRICHED, RAW } from "./workbookData";

/** The People table as an agent leaves it: ten rows, contacts only; the enrichment columns are empty. */
export function WorkbookRaw() {
  return <WorkbookFrame variant={RAW} />;
}

/** The same ten rows after Apollo and the verifier have run. */
export function WorkbookEnriched() {
  return <WorkbookFrame variant={ENRICHED} />;
}

const addColumn = click("button", "Add column");

const dialogSteps = [
  addColumn,
  click("button", "Add enrichment"),
  click("aside button", "Apollo"),
  click("main button:not([disabled])", "Find work email"),
  pick(0, "Name"),
  pick(1, "Website"),
];
const catalogSteps = dialogSteps.slice(0, 3);

/** The Add enrichment catalog on the raw table with Apollo chosen, before an action is picked. */
export function WorkbookEnrichCatalog() {
  return <WorkbookFrame variant={RAW} wrap={(client) => <Drive steps={catalogSteps}>{client}</Drive>} />;
}
