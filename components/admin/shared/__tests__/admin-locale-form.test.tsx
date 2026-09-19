import { useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminLocaleWorkspace } from "@/components/admin/shared/admin-locale-workspace";
import { localeOfFirstError } from "@/components/admin/shared/admin-locale-panel";
import { useAdminFormValidation } from "@/components/admin/shared/admin-form-validation";

// Minimal stand-in for a real entity editor (Product/Collection/Page): one
// shared field (media/collection selection) plus EN/PT title fields, wired
// exactly the way Task 9/12/15 forms will wire the real thing. Like those
// forms, PT requiredness is a server-side (publish-state-dependent) concern
// reported back via showFieldErrors — not a native `required` attribute,
// since whether PT is required at all depends on publish state (the
// registry's "when-published"), which a static `required` can't express.
function DemoForm({
  onSubmit,
  serverFieldErrors,
}: {
  onSubmit: (data: Record<string, string>) => void;
  serverFieldErrors?: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const validation = useAdminFormValidation<"title" | "ptTitle">({ formRef });
  const [mediaCount, setMediaCount] = useState(1);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validation.validate()) return;
        if (serverFieldErrors) {
          validation.showFieldErrors(serverFieldErrors as Partial<Record<"title" | "ptTitle", string>>);
          return;
        }
        onSubmit(Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>);
      }}
    >
      <AdminLocaleWorkspace
        storageKey="demo"
        forceLocale={localeOfFirstError(validation.fieldErrors)}
        sharedHeader={
          <div>
            <span>Media count: {mediaCount}</span>
            <button type="button" onClick={() => setMediaCount((n) => n + 1)}>Add media</button>
          </div>
        }
        en={<input aria-label="Title (EN)" name="title" defaultValue="" />}
        pt={<input aria-label="Title (PT)" name="ptTitle" defaultValue="" />}
      />
      <button type="submit">Save</button>
    </form>
  );
}

describe("locale-aware form state", () => {
  it("keeps EN and PT input independent across tab switches and submits both plus the shared value", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DemoForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Title (EN)"), "Lava Ring");
    await user.click(screen.getByRole("tab", { name: "Português" }));
    await user.type(screen.getByLabelText("Title (PT)"), "Anel de Lava");
    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByLabelText<HTMLInputElement>("Title (EN)").value).toBe("Lava Ring");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith({ title: "Lava Ring", ptTitle: "Anel de Lava" });
  });

  it("does not reset the shared field when switching locales", async () => {
    const user = userEvent.setup();
    render(<DemoForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add media" }));
    expect(screen.getByText("Media count: 2")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Português" }));
    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByText("Media count: 2")).toBeInTheDocument();
  });

  it("opens the PT tab automatically when the server reports a PT field error", async () => {
    const user = userEvent.setup();
    render(<DemoForm onSubmit={vi.fn()} serverFieldErrors={{ ptTitle: "Portuguese title is required to publish." }} />);

    await user.type(screen.getByLabelText("Title (EN)"), "Lava Ring");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByLabelText("Title (PT)").closest('[role="tabpanel"]')).not.toHaveAttribute("hidden");
  });
});
