import { CrmActionsClient } from "@/components/crm/CrmActionsClient";
import { CrmLayout } from "@/components/crm/CrmLayout";
import { CrmPipelineClient } from "@/components/crm/CrmPipelineClient";
import { AppScreen } from "../Shell";
import "./routes";

/** /crm/actions — the real page body, fed by the mocked CRM API. */
export function Actions() {
  return <AppScreen path="/crm/actions" active="/crm/actions"><CrmLayout><CrmActionsClient /></CrmLayout></AppScreen>;
}

export function Pipeline() {
  return <AppScreen path="/crm/pipeline" active="/crm/pipeline"><CrmLayout><CrmPipelineClient /></CrmLayout></AppScreen>;
}
