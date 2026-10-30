import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildCalendarMonth,
  calendarMax,
  calendarMin,
  computeLunarForDay,
  fetchCalendarMonthAsync,
  getCalendarDay,
  loadLunarModule,
  shiftCalendarDay,
  type CalendarDay,
} from "../../lib/calendar";
import { ThemedSelect } from "../ui/ThemedSelect";

export default function CalendarPopover({ today }: { today: string }) {
  const initial = today < calendarMin ? calendarMin : today > calendarMax ? calendarMax : today;
  const [selected, setSelected] = useState(initial);
  const [focused, setFocused] = useState(initial);
  const [view, setView] = useState(() => initial.slice(0, 7));
  const [year, month] = view.split("-").map(Number);

  // 首帧立即返回基础数据（毫秒级），不阻塞 UI 渲染
  const [cells, setCells] = useState<(CalendarDay | null)[]>(() => buildCalendarMonth(year, month));
  const [details, setDetails] = useState<CalendarDay>(() => getCalendarDay(selected));
  const grid = useRef<HTMLDivElement>(null);

  // 视图年月切换时，先以极速基础公历占位，再异步加载完整农历与节气数据
  useEffect(() => {
    let active = true;
    // 立即更新为基础或已有缓存的公历网格
    setCells(buildCalendarMonth(year, month));

    void fetchCalendarMonthAsync(year, month).then((fullCells) => {
      if (active) {
        setCells(fullCells);
      }
    });

    return () => {
      active = false;
    };
  }, [year, month]);

  // 选中日期变化时，更新下方详情卡片
  useEffect(() => {
    let active = true;
    setDetails(getCalendarDay(selected));
    void loadLunarModule().then((SolarClass) => {
      if (active) {
        setDetails(computeLunarForDay(selected, SolarClass));
      }
    }).catch(() => {
      // 保持基础日期展示
    });

    return () => {
      active = false;
    };
  }, [selected]);

  const focusDay = (key: string, focus = false) => {
    setFocused(key);
    setView(key.slice(0, 7));
    if (focus) {
      requestAnimationFrame(() =>
        grid.current?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)?.focus()
      );
    }
  };

  const changeMonth = (newYear: number, newMonth: number) => {
    const key = `${newYear}-${String(newMonth).padStart(2, "0")}-01`;
    focusDay(key);
  };

  const shiftMonth = (delta: number) => {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    changeMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    const current = getCalendarDay(key);
    const weekday = (current.weekday + 6) % 7;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    const delta = moves[event.key];
    if (delta != null) {
      event.preventDefault();
      focusDay(shiftCalendarDay(key, delta), true);
    }
  };

  return (
    <div className="calendar-body">
      <div className="calendar-toolbar">
        <button
          type="button"
          className="icon-button"
          aria-label="上个月"
          disabled={view === "1900-01"}
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="calendar-month-selects">
          <ThemedSelect
            aria-label="年份"
            value={String(year)}
            onValueChange={(value) => changeMonth(Number(value), month)}
            options={Array.from({ length: 201 }, (_, index) => ({
              value: String(1900 + index),
              label: `${1900 + index} 年`,
            }))}
          />
          <ThemedSelect
            aria-label="月份"
            value={String(month)}
            onValueChange={(value) => changeMonth(year, Number(value))}
            options={Array.from({ length: 12 }, (_, index) => ({
              value: String(index + 1),
              label: `${index + 1} 月`,
            }))}
          />
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="下个月"
          disabled={view === "2100-12"}
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div
        className="calendar-grid"
        ref={grid}
        role="group"
        aria-label={`${year}年${month}月日期，方向键切换日期`}
      >
        {cells.map((day, index) =>
          day ? (
            <button
              type="button"
              key={day.key}
              data-day={day.key}
              className={`calendar-day ${day.month === month ? "" : "outside"} ${
                day.key === today ? "today" : ""
              } ${day.key === selected ? "selected" : ""}`}
              tabIndex={day.key === focused ? 0 : -1}
              aria-pressed={day.key === selected}
              aria-current={day.key === today ? "date" : undefined}
              aria-label={`${day.year}年${day.month}月${day.day}日${
                day.lunar ? `，农历${day.lunar}` : ""
              }${day.solarTerm ? `，${day.solarTerm}` : ""}${
                day.festivals.length ? `，${day.festivals.join("、")}` : ""
              }`}
              onFocus={() => setFocused(day.key)}
              onKeyDown={(event) => onKeyDown(event, day.key)}
              onClick={() => {
                setSelected(day.key);
                focusDay(day.key);
              }}
            >
              <strong>{day.day}</strong>
              <small
                className={
                  day.solarTerm || day.festivals.length ? "calendar-special" : ""
                }
              >
                {day.solarTerm || day.festivals[0] || day.lunarShort || "·"}
              </small>
            </button>
          ) : (
            <span className="calendar-day disabled" key={`empty-${index}`} />
          )
        )}
      </div>

      <div className="calendar-details" aria-live="polite">
        <strong>
          {details.year}年{details.month}月{details.day}日
        </strong>
        <span>农历 {details.lunar || "计算中…"}</span>
        {(details.solarTerm || details.festivals.length > 0) && (
          <span className="calendar-special">
            {[details.solarTerm, ...details.festivals].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      <div className="calendar-footer">
        <small>1900–2100 年 · 节气按北京时间日期标注</small>
        <button
          type="button"
          className="quiet-button"
          disabled={today < calendarMin || today > calendarMax}
          onClick={() => {
            setSelected(today);
            focusDay(today);
          }}
        >
          回到今天
        </button>
      </div>
    </div>
  );
}
