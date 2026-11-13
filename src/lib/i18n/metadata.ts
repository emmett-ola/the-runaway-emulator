export interface LocaleMetadata {
  tag: string;
  name: string;
  aliases: string[];
  calendarWeekdayLength: number;
  logTag: string;
  logOptions: Intl.DateTimeFormatOptions;
}
