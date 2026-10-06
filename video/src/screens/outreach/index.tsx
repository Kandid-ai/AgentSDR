import type { ComponentType } from "react";
import { LinkedinMessages } from "./LinkedinMessages";
import { EmailCampaign } from "./EmailCampaign";

/** The outreach screens the film shows, by name. Each is a real app screen on sample data. */
export const SCREENS: Record<string, ComponentType> = {
  "email-campaign": EmailCampaign,
  "linkedin-messages": LinkedinMessages,
};
