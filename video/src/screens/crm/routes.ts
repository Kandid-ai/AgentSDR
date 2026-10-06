import { mockRoutes } from "../mock";
import { ACTIONS, MAYA_RECORD, CATEGORIES, PIPELINE, SEQUENCES, STAGE_COUNTS } from "./data";

/** The CRM list endpoints, answered with sample data. Imported once for its side effect. */
mockRoutes([
  {
    match: "/api/crm/actions",
    respond: (url) => {
      const pipeline = url.searchParams.get("scope") === "pipeline";
      const source = pipeline ? PIPELINE : ACTIONS;
      const recordId = url.searchParams.get("recordId");
      const stage = url.searchParams.get("stage");
      const limit = Number(url.searchParams.get("limit") ?? 30);
      let items = source;
      if (recordId) items = items.filter((a) => a.id === recordId);
      if (pipeline && stage) items = items.filter((a) => a.stage === stage);
      items = items.slice(0, limit);
      return { actions: items, total: pipeline ? source.length : ACTIONS.length, hasMore: false, nextOffset: items.length, stageCounts: STAGE_COUNTS };
    },
  },
  { match: "/api/crm/records/maya", respond: () => MAYA_RECORD },
  { match: "/api/crm/categories", respond: () => ({ categories: CATEGORIES }) },
  { match: "/api/crm/sequences", respond: () => ({ sequences: SEQUENCES }) },
  { match: "/api/crm/overview", respond: () => ({ actionRequired: 8, overdue: 2, byWorkflowState: { error: 0, action_required: 8 } }) },
  { match: "/api/calls", respond: () => ({ calls: [] }) },
  { match: "/api/nav/badges", respond: () => ({ draftsAwaitingReview: 8 }) },
]);
