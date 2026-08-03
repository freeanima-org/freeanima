declare module "lunar-javascript" {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }

  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getSolar(): Solar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }

  export class LunarMonth {
    static fromYm(year: number, month: number): LunarMonth;
    next(n: number): LunarMonth;
    getYear(): number;
    getMonth(): number;
    getDayCount(): number;
    isLeap(): boolean;
  }
}
