import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { CrmActionGroup } from "./actionGroups";

/** The crm_records columns the grouping reads — Drizzle columns, or raw `r.<column>` under an alias. */
export type CrmRecordColumns = { id: SQLWrapper; workflowState: SQLWrapper; nextActionAt: SQLWrapper };

/**
 * The Action required condition: a draft or classification to review, an
 * error to clear, or a follow-up that has come due. Records mid-flight
 * (classifying, waiting on a future step) are not actionable yet.
 */
export function crmActionableSql(r: CrmRecordColumns): SQL {
  return sql`(${r.workflowState} in ('action_required', 'error')
    or (${r.workflowState} = 'waiting' and ${r.nextActionAt} <= now())
    or (${r.workflowState} <> 'closed' and ${crmMeetingOutcomeDueSql(r)}))`;
}

/**
 * The record has a meeting that is over and nobody has said whether they
 * showed up (crm_meetings, src/lib/crm/meetings.ts) — on a person's desk
 * whatever the record is otherwise waiting on. crm_meetings is reached
 * through the record, which the caller scopes to the organization.
 *
 * Written as `id in (…)` rather than a correlated EXISTS: in a single-table
 * select list Drizzle prints the record's column unqualified ("id"), which
 * inside the subquery would bind to the meeting's own id.
 */
export function crmMeetingOutcomeDueSql(r: Pick<CrmRecordColumns, "id">): SQL {
  return sql`${r.id} in (select due_meeting.crm_record_id from crm_meetings due_meeting
    where due_meeting.status = 'booked' and due_meeting.outcome is null and due_meeting.end_at <= now())`;
}

/** A send of the record is waiting to be reconciled: that stays first, as 'problem'. Uncorrelated for the same reason. */
function deliveryUncertainSql(r: Pick<CrmRecordColumns, "id">): SQL {
  return sql`${r.id} in (select uncertain.crm_record_id from crm_drafts uncertain where uncertain.status = 'delivery_uncertain')`;
}

/**
 * The record's CrmActionGroup, or NULL when it is not in the queue. Mirrors the
 * precedence listCrmActions uses to name each row's action — error (or a
 * delivery to reconcile), then a meeting to answer "Did they show up?" for,
 * then a proposed classification, then the newest open draft, then the schedule — so
 * a count or filter on a group agrees with the labels the rows show. Only the
 * newest open draft counts, and a failed one falls through to the schedule.
 *
 * Follow-ups are the drafted ones awaiting approval plus those past their
 * time with nothing drafted. Counting only `waiting` records past due, as the
 * Follow-ups due figure once did, read 0 while 96 sat in the queue: a record
 * holding a follow-up draft is `action_required`, not `waiting`.
 */
export function crmActionGroupSql(r: CrmRecordColumns): SQL<CrmActionGroup | null> {
  return sql<CrmActionGroup | null>`case when ${crmActionableSql(r)} then
    case when ${r.workflowState} = 'error' then 'problem'
      when ${crmMeetingOutcomeDueSql(r)} and not (${deliveryUncertainSql(r)}) then 'meeting_outcome'
      when (select c.status from crm_classifications c where c.crm_record_id = ${r.id}
             order by c.created_at desc limit 1) = 'proposed' then 'classification'
      else coalesce(
        (select case when d.status = 'delivery_uncertain' then 'problem'
                     when d.status = 'awaiting_review' then case when st.step_type = 'follow_up' then 'follow_up' else 'reply' end
                end
           from crm_drafts d
           left join crm_sequence_step_runs sr on sr.id = d.sequence_step_run_id
           left join crm_sequence_steps st on st.id = sr.sequence_step_id
          where d.crm_record_id = ${r.id} and d.status in ('awaiting_review', 'failed', 'delivery_uncertain')
          order by d.updated_at desc limit 1),
        case when ${r.nextActionAt} <= now() then 'follow_up' else 'next_step' end)
    end
  end`;
}
