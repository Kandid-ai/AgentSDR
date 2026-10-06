import { CRM_SCENES } from "./crm";
import { EMAIL_SCENES } from "./email";
import type { Scene } from "./kit";
import { LINKEDIN_SCENES } from "./linkedin";
import { WHATSAPP_SCENES } from "./whatsapp";

/** One scene per capability, in the order the channel lists them. */
export const SCENES: Record<string, readonly Scene[]> = {
  email: EMAIL_SCENES,
  linkedin: LINKEDIN_SCENES,
  whatsapp: WHATSAPP_SCENES,
  crm: CRM_SCENES,
};

export { SceneFit } from "./kit";
