"use client";

import {
  RiBookmarkLine,
  RiBriefcaseLine,
  RiCalendarCheckLine,
  RiChat3Line,
  RiFireLine,
  RiFlagLine,
  RiFocus3Line,
  RiHeartLine,
  RiKanbanView2,
  RiLightbulbLine,
  RiMailLine,
  RiMoneyDollarCircleLine,
  RiPhoneLine,
  RiRocketLine,
  RiShakeHandsLine,
  RiStarLine,
  RiTeamLine,
  RiTimeLine,
  RiTrophyLine,
  RiUserLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import * as Popover from "@/components/alignui/popover";
import { VIEW_ICON_KEYS, type ViewIconKey } from "@/lib/crm/boardViews";
import { cn } from "@/utils/cn";

/** How each view icon key is drawn (the keys live in boardViews.ts). */
export const VIEW_ICONS: Record<ViewIconKey, { icon: RemixiconComponentType; label: string }> = {
  kanban: { icon: RiKanbanView2, label: "Board" },
  target: { icon: RiFocus3Line, label: "Target" },
  fire: { icon: RiFireLine, label: "Hot" },
  rocket: { icon: RiRocketLine, label: "Rocket" },
  star: { icon: RiStarLine, label: "Star" },
  flag: { icon: RiFlagLine, label: "Flag" },
  calendar: { icon: RiCalendarCheckLine, label: "Meeting" },
  handshake: { icon: RiShakeHandsLine, label: "Deal" },
  trophy: { icon: RiTrophyLine, label: "Won" },
  money: { icon: RiMoneyDollarCircleLine, label: "Money" },
  briefcase: { icon: RiBriefcaseLine, label: "Business" },
  mail: { icon: RiMailLine, label: "Email" },
  phone: { icon: RiPhoneLine, label: "Phone" },
  chat: { icon: RiChat3Line, label: "Chat" },
  user: { icon: RiUserLine, label: "Person" },
  team: { icon: RiTeamLine, label: "Team" },
  lightbulb: { icon: RiLightbulbLine, label: "Idea" },
  time: { icon: RiTimeLine, label: "Later" },
  bookmark: { icon: RiBookmarkLine, label: "Saved" },
  heart: { icon: RiHeartLine, label: "Favourite" },
};

/** The picker: the view's icon as a button that opens a grid of the others. */
export function ViewIconPicker({ value, onChange, className }: { value: ViewIconKey; onChange: (icon: ViewIconKey) => void; className?: string }) {
  const Current = VIEW_ICONS[value].icon;
  return <Popover.Root>
    <Popover.Trigger asChild>
      <button type="button" aria-label="Change the view's icon" title="Change icon" className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-bg-weak-50 text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200 outline-none transition hover:ring-stroke-sub-300 focus-visible:ring-2 focus-visible:ring-primary-base", className)}>
        <Current className="size-5" />
      </button>
    </Popover.Trigger>
    <Popover.Content align="start" showArrow={false} sideOffset={6} className="w-auto p-2">
      <div className="grid grid-cols-5 gap-1" role="listbox" aria-label="Icons">
        {VIEW_ICON_KEYS.map((key) => {
          const Icon = VIEW_ICONS[key].icon;
          const selected = key === value;
          return <Popover.Close asChild unstyled key={key}>
            <button type="button" role="option" aria-selected={selected} title={VIEW_ICONS[key].label} onClick={() => onChange(key)} className={cn("flex size-9 items-center justify-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-primary-base", selected ? "bg-primary-alpha-10 text-primary-base" : "text-text-sub-600 hover:bg-bg-weak-50 hover:text-text-strong-950")}>
              <Icon className="size-[18px]" />
            </button>
          </Popover.Close>;
        })}
      </div>
    </Popover.Content>
  </Popover.Root>;
}
