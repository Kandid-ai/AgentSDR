import { WorkbookFrame } from "./WorkbookFrame";
import { FULL } from "./workbookData";

/** /tables/[workbookId] — the real WorkbookClient (AG Grid) on the full sample People table. */
export function Workbook() {
  return <WorkbookFrame variant={FULL} />;
}
