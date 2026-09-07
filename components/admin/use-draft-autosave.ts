"use client";

import { useEffect, useRef } from "react";

type DraftAutosaveResult = {
  recordId?: string;
};

type DraftAutosaveOptions<T extends DraftAutosaveResult> = {
  formRef: React.RefObject<HTMLFormElement | null>;
  saveDraft: (formData: FormData) => Promise<T>;
  onSaved?: (result: T) => void;
  recordIdField?: string;
  debounceMs?: number;
};

export function buildDraftFormData(form: HTMLFormElement) {
  const draftData = new FormData();

  for (const [name, value] of new FormData(form).entries()) {
    // Files are uploaded only by the explicit save action. Including them in
    // autosave makes every keystroke resend large multipart bodies and can
    // leave Next's parser with a truncated request during navigation/HMR.
    if (value instanceof File) continue;
    draftData.append(name, value);
  }

  return draftData;
}

export function useDraftAutosave<T extends DraftAutosaveResult>({
  formRef,
  saveDraft,
  onSaved,
  recordIdField,
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
        const result = await saveDraftRef.current(buildDraftFormData(form));

        // A queued autosave can flush before React commits the state update made
        // by onSaved. Persist the identity in the live form first so the next
        // request updates the draft instead of attempting a duplicate create.
        if (result.recordId && recordIdField) {
          const field = form.elements.namedItem(recordIdField);
          if (field instanceof HTMLInputElement) {
            field.value = result.recordId;
          }
        }

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

      // File selection is intentionally handled only by explicit upload/save
      // controls. Dispatching a Server Action from a file input's change event
      // can race the browser's multipart stream and surface as an opaque
      // "Unexpected end of form" before the action body is reached.
      if (target instanceof HTMLInputElement && target.type === "file") {
        return;
      }

      scheduleDraftSave();
    };

    const cancelPendingSave = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      dirtyRef.current = false;
      queuedRef.current = false;
    };

    form.addEventListener("input", handleInput);
    form.addEventListener("change", handleInput);
    window.addEventListener("pagehide", cancelPendingSave);

    return () => {
      form.removeEventListener("input", handleInput);
      form.removeEventListener("change", handleInput);
      window.removeEventListener("pagehide", cancelPendingSave);
      cancelPendingSave();
    };
  }, [debounceMs, formRef, recordIdField]);
}
