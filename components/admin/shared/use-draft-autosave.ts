"use client";

import { useEffect, useRef } from "react";

type DraftAutosaveResult = {
  recordId?: string;
  error?: string;
};

type DraftAutosaveOptions<T extends DraftAutosaveResult> = {
  formRef: React.RefObject<HTMLFormElement | null>;
  saveDraft: (formData: FormData) => Promise<T>;
  onSaved?: (result: T) => void;
  onError?: (error: unknown) => void;
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
  onError,
  recordIdField,
  debounceMs = 700,
}: DraftAutosaveOptions<T>) {
  const dirtyRef = useRef(false);
  const queuedRef = useRef(false);
  const savingRef = useRef(false);
  const failureCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraftRef = useRef(saveDraft);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    saveDraftRef.current = saveDraft;
    onSavedRef.current = onSaved;
    onErrorRef.current = onError;
  }, [onError, onSaved, saveDraft]);

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

      let failed = false;
      try {
        const result = await saveDraftRef.current(buildDraftFormData(form));

        // A queued autosave can flush before React commits the state update made
        // by onSaved. Persist the identity in the live form first so the next
        // request updates the draft instead of attempting a duplicate create.
        if (result.error) {
          dirtyRef.current = true;
          failed = true;
          onSavedRef.current?.(result);
          return;
        }

        failureCountRef.current = 0;

        if (result.recordId && recordIdField) {
          const field = form.elements.namedItem(recordIdField);
          if (field instanceof HTMLInputElement) {
            field.value = result.recordId;
          }
        }

        onSavedRef.current?.(result);
      } catch (error) {
        dirtyRef.current = true;
        failed = true;
        onErrorRef.current?.(error);
      } finally {
        savingRef.current = false;

        if (queuedRef.current) {
          queuedRef.current = false;
          void flushDraft();
        } else if (failed && failureCountRef.current < 3) {
          failureCountRef.current += 1;
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void flushDraft();
          }, 2000 * failureCountRef.current);
        }
      }
    }

    function scheduleDraftSave() {
      dirtyRef.current = true;
      failureCountRef.current = 0;
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

      // Search/autocomplete text can be transient while a separate hidden
      // field holds the confirmed value. Autosaving the transient keystrokes
      // would clear or replace a valid selection before the user chooses one.
      if (target.dataset.draftAutosave === "ignore") {
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
      failureCountRef.current = 0;
    };

    const hasUnsavedChanges = () => dirtyRef.current || savingRef.current || queuedRef.current;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const warnBeforeInternalNavigation = (event: MouseEvent) => {
      if (!hasUnsavedChanges() || event.defaultPrevented) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!link || link.closest("form") === form || !link.getAttribute("href")?.startsWith("/")) return;
      if (!window.confirm("Your latest draft changes have not been saved. Leave this page?")) {
        event.preventDefault();
      }
    };

    form.addEventListener("input", handleInput);
    form.addEventListener("change", handleInput);
    form.addEventListener("reset", cancelPendingSave);
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeInternalNavigation, true);
    window.addEventListener("pagehide", cancelPendingSave);

    return () => {
      form.removeEventListener("input", handleInput);
      form.removeEventListener("change", handleInput);
      form.removeEventListener("reset", cancelPendingSave);
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeInternalNavigation, true);
      window.removeEventListener("pagehide", cancelPendingSave);
      cancelPendingSave();
    };
  }, [debounceMs, formRef, recordIdField]);
}
