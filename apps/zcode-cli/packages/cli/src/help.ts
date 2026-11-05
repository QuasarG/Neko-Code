import { getNekodeCopy, type SupportedLocale, type UiLocale } from "@zcode/i18n";

export function formatCliHelp(
  version: string,
  locale?: UiLocale,
  detectedLocale?: SupportedLocale,
): string {
  return getNekodeCopy(locale, detectedLocale).cli.help(version);
}
