import { useMemo, useState, type CSSProperties } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { Popover } from "radix-ui";
import type { AppearanceSettings } from "../../lib/appearance";
import { dateKey, formatClock, getIntlLunarSummary } from "../../lib/time";
import { loadLunarModule } from "../../lib/calendar";
import { useClock } from "../../hooks/use-clock";
import { ClockDisplay } from "../ClockDisplay";
import { WorldClockPopover } from "./WorldClockPopover";
import CalendarPopover from "./CalendarPopover";
import "./clock.css";

export function ClockDateWidget({
  appearance,
  timezone,
}: {
  appearance: AppearanceSettings;
  timezone?: string;
}) {
  const now = useClock();
  const [worldClockOpen, setWorldClockOpen] = useState(false);
  const today = dateKey(now, timezone);
  const { time, date } = formatClock(now, timezone, appearance);
  const lunar = useMemo(() => getIntlLunarSummary(new Date(`${today}T12:00:00Z`), "UTC"), [today]);

  const preloadCalendar = () => {
    void loadLunarModule();
  };
  return (
    <div
      className={`clock-date-widget date-${appearance.dateStyle}`}
      style={{ "--clock-color": appearance.clockColor } as CSSProperties}
    >
      <WorldClockPopover
        open={worldClockOpen}
        onOpenChange={setWorldClockOpen}
        baseTimezone={timezone}
        trigger={
          <button
            type="button"
            className={`clock-time-trigger time-inline clock-${appearance.clockStyle}`}
            title="查看世界时钟"
            aria-label="查看世界时钟"
            aria-expanded={worldClockOpen}
          >
            <Clock3 className="clock-mark" size={18} />
            <ClockDisplay time={time} appearance={appearance} now={now} timezone={timezone} />
          </button>
        }
      />

      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="clock-date-trigger"
            aria-label={`打开万年历，${date}，农历${lunar || "暂不可用"}`}
            title="打开万年历"
            onMouseEnter={preloadCalendar}
            onFocus={preloadCalendar}
          >
            <CalendarDays size={16} />
            <span className="clock-date-text">{date}</span>
            {appearance.dateStyle === "lunar" && (
              <small className="clock-lunar-text">农历 {lunar || "暂不可用"}</small>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="calendar-popover"
            aria-label="万年历"
            align="end"
            sideOffset={10}
            collisionPadding={8}
          >
            <h2 className="visually-hidden">万年历</h2>
            <CalendarPopover today={today} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
