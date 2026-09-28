import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EphemeralToastProvider,
  useEphemeralToast,
  MAX_VISIBLE_TOASTS,
  TOAST_DURATION_MS,
} from "../ephemeral-toast";
import { enqueueToast } from "../ephemeral-toast-queue";

function ToastProbe() {
  const { pushToast } = useEphemeralToast();
  return (
    <div>
      <button type="button" onClick={() => pushToast({ message: "Saved.", tone: "success" })}>
        Success
      </button>
      <button type="button" onClick={() => pushToast({ message: "Could not save.", tone: "error" })}>
        Error
      </button>
      <button type="button" onClick={() => pushToast({ message: "Could not save.", tone: "error" })}>
        Duplicate error
      </button>
      <button
        type="button"
        onClick={() => {
          pushToast({ message: "First note.", tone: "info" });
          pushToast({ message: "Second note.", tone: "info" });
          pushToast({ message: "Third note.", tone: "info" });
        }}
      >
        Burst
      </button>
    </div>
  );
}

describe("ephemeral-toast-queue", () => {
  it("caps concurrent toasts and keeps the newest", () => {
    const first = { id: "1", message: "A", tone: "info" as const };
    const second = { id: "2", message: "B", tone: "info" as const };
    const third = { id: "3", message: "C", tone: "info" as const };
    const queued = enqueueToast(enqueueToast([first], second), third);
    expect(queued).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(queued.map((toast) => toast.message)).toEqual(["B", "C"]);
  });

  it("collapses duplicate message+tone into one card", () => {
    const first = { id: "1", message: "Could not save.", tone: "error" as const };
    const second = { id: "2", message: "Could not save.", tone: "error" as const };
    expect(enqueueToast([first], second)).toEqual([second]);
  });
});

describe("EphemeralToastProvider", () => {
  it("shows an alert for errors and auto-dismisses after the tone duration", () => {
    vi.useFakeTimers();
    render(
      <EphemeralToastProvider>
        <ToastProbe />
      </EphemeralToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Error" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save.");

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS.error - 1);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("pauses auto-dismiss while hovered and resumes afterward", () => {
    vi.useFakeTimers();
    render(
      <EphemeralToastProvider>
        <ToastProbe />
      </EphemeralToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    const toast = screen.getByRole("status");
    fireEvent.mouseEnter(toast);

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS.success + 2_000);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS.success);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("dismisses from the close control without stealing focus from the trigger", () => {
    render(
      <EphemeralToastProvider>
        <ToastProbe />
      </EphemeralToastProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Error" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Close notification" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces duplicates and never shows more than the concurrent cap", () => {
    render(
      <EphemeralToastProvider>
        <ToastProbe />
      </EphemeralToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Error" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate error" }));
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Burst" }));
    expect(screen.getAllByRole("status")).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(screen.queryByText("First note.")).not.toBeInTheDocument();
    expect(screen.getByText("Second note.")).toBeInTheDocument();
    expect(screen.getByText("Third note.")).toBeInTheDocument();
  });

  it("marks the admin surface and announces so Save tooltips yield", () => {
    const announced = vi.fn();
    window.addEventListener("synarava:ephemeral-toast", announced);
    render(
      <EphemeralToastProvider surface="admin">
        <ToastProbe />
      </EphemeralToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    const root = document.querySelector("[data-ephemeral-toast-root][data-surface='admin']");
    expect(root).toHaveClass("ephemeral-toast-stack--admin");
    expect(announced).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    window.removeEventListener("synarava:ephemeral-toast", announced);
  });
});
