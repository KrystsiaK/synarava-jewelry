// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSyncedState } from "../use-synced-state";

describe("useSyncedState", () => {
  it("starts from the server value", () => {
    const { result } = renderHook(({ server }) => useSyncedState(server), { initialProps: { server: { n: 4 } } });
    expect(result.current[0]).toEqual({ n: 4 });
  });

  it("keeps local updates while the server value is unchanged", () => {
    const server = { n: 4 };
    const { result, rerender } = renderHook(({ s }) => useSyncedState(s), { initialProps: { s: server } });
    act(() => result.current[1]({ n: 3 }));
    rerender({ s: server });
    expect(result.current[0]).toEqual({ n: 3 });
  });

  it("follows a NEW server value (router.refresh) and drops the stale copy", () => {
    const { result, rerender } = renderHook(({ s }) => useSyncedState(s), { initialProps: { s: { n: 4 } } });
    act(() => result.current[1]({ n: 3 }));
    rerender({ s: { n: 5 } });
    expect(result.current[0]).toEqual({ n: 5 });
  });
});
