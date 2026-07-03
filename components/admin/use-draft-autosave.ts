"use client";

import { useEffect, useRef } from "react";

type DraftAutosaveOptions<T> = {
  formRef: React.RefObject<HTMLFormElement | null>;
  saveDraft: (formData: FormData) => Promise<T>;
  onSaved?: (result: T) => void;
  debounceMs?: number;
};

export function useDraftAutosave<T>({
  formRef,
  saveDraft,
  onSaved,
  debounceMs = 700,
}: DraftAutosaveOptions<T>) {
  const dirtyRef = useRef(false);
  const queuedRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraftRef = useRef(saveDraft);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    saveDraftRef.current = saveDraft;
    onSavedRef.current = onSaved;
  }, [onSaved, saveDraft]);

  useEffect(() => {
    async function flushDraft() {
      const form = formRef.current;
      if (!form) return;

      if (savingRef.current) {
        queuedRef.current = true;
        return;
      }

      if (!dirtyRef.current) return;

      dirtyRef.current = false;
      savingRef.current = true;

      try {
        const result = await saveDraftRef.current(new FormData(form));
        onSavedRef.current?.(result);
      } finally {
        savingRef.current = false;

        if (queuedRef.current || dirtyRef.current) {
          queuedRef.current = false;
          void flushDraft();
        }
      }
    }

    function scheduleDraftSave() {
      dirtyRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flushDraft();
      }, debounceMs);
    }

    const form = formRef.current;
    if (!form) return;

    const handleInput = (event: Event) => {
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement) &&
        !(target instanceof HTMLSelectElement)
      ) {
        return;
      }

      scheduleDraftSave();
    };

    const handlePageHide = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void flushDraft();
    };

    form.addEventListener("input", handleInput);
    form.addEventListener("change", handleInput);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      form.removeEventListener("input", handleInput);
      form.removeEventListener("change", handleInput);
      window.removeEventListener("pagehide", handlePageHide);
      if (timerRef.current) clearTimeout(timerRef.current);
      void flushDraft();
    };
  }, [debounceMs, formRef]);
}
