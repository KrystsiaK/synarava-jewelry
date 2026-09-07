import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";

import { useDraftAutosave } from "../use-draft-autosave";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("useDraftAutosave", () => {
  it("writes the created record id into the form before flushing a queued save", async () => {
    vi.useFakeTimers();
    const firstSave = deferred<{ recordId?: string }>();
    const saveDraft = vi
      .fn<(formData: FormData) => Promise<{ recordId?: string }>>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValue({ recordId: "product-1" });

    function TestForm() {
      const formRef = useRef<HTMLFormElement>(null);
      useDraftAutosave({
        formRef,
        saveDraft,
        recordIdField: "productId",
      });

      return (
        <form ref={formRef}>
          <input type="hidden" name="productId" defaultValue="" />
          <input name="name" defaultValue="" />
          <input name="imageFile" type="file" />
        </form>
      );
    }

    const { container } = render(<TestForm />);
    const nameInput = container.querySelector<HTMLInputElement>('input[name="name"]')!;

    fireEvent.input(nameInput, { target: { value: "Midnight" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);

    fireEvent.input(nameInput, { target: { value: "Midnight Duck" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    await act(async () => {
      firstSave.resolve({ recordId: "product-1" });
      await firstSave.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft.mock.calls[1]?.[0].get("productId")).toBe("product-1");
    expect(saveDraft.mock.calls[1]?.[0].has("imageFile")).toBe(false);

    vi.useRealTimers();
  });

  it("does not start a server action while the page is being unloaded", async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue({});

    function TestForm() {
      const formRef = useRef<HTMLFormElement>(null);
      useDraftAutosave({ formRef, saveDraft });
      return (
        <form ref={formRef}>
          <input name="name" defaultValue="" />
        </form>
      );
    }

    const { container } = render(<TestForm />);
    fireEvent.input(container.querySelector<HTMLInputElement>('input[name="name"]')!, {
      target: { value: "Unsaved title" },
    });

    window.dispatchEvent(new Event("pagehide"));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(saveDraft).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not autosave when a file input changes", async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue({});

    function TestForm() {
      const formRef = useRef<HTMLFormElement>(null);
      useDraftAutosave({ formRef, saveDraft });
      return <form ref={formRef}><input name="imageFile" type="file" /></form>;
    }

    const { container } = render(<TestForm />);
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [file] },
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(saveDraft).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
