export function revalidatePath() {}
export function revalidateTag() {}
export function unstable_cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
