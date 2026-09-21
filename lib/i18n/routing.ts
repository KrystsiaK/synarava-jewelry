export function localePath(locale: string, path: string) {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
