import { isHoliday, isWorkday } from "chinese-days";
import { Lunar, Solar } from "lunar-javascript";

import { formatCstIso } from "./time.ts";

function toCnDateKey(date: Date): string {
  return formatCstIso(date).slice(0, 10);
}

function cstWeekday(date: Date): number {
  const iso = formatCstIso(date);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    throw new Error(`invalid CST iso: ${iso}`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** 自然周末（周六/日，不含调休上班判定） */
export function isCnWeekend(date: Date): boolean {
  const wd = cstWeekday(date);
  return wd === 0 || wd === 6;
}

/** 中国法定工作日（含调休上班日） */
export function isCnWorkday(date: Date): boolean {
  return isWorkday(toCnDateKey(date));
}

/** 中国法定假日 */
export function isCnHoliday(date: Date): boolean {
  return isHoliday(toCnDateKey(date));
}

/** 农历 → 公历（返回 CST 日历日；时刻为 12:00 占位，调用方保留原时刻） */
export function gregorianFromLunar(year: number, month: number, day: number): Date {
  const lunar = Lunar.fromYmd(year, month, day);
  const solar = lunar.getSolar();
  const y = solar.getYear();
  const mo = solar.getMonth();
  const d = solar.getDay();
  return new Date(
    `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+08:00`,
  );
}

/** 公历（CST 日历日）→ 农历年月日 */
export function lunarPartsFromGregorian(date: Date): { year: number; month: number; day: number } {
  const iso = formatCstIso(date);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    throw new Error(`invalid CST iso: ${iso}`);
  }
  const solar = Solar.fromYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  const lunar = solar.getLunar();
  return { year: lunar.getYear(), month: lunar.getMonth(), day: lunar.getDay() };
}
