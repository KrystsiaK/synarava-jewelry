import { fireEvent, render, screen } from "@testing-library/react";

import { AdminErrorState } from "@/components/admin/shared/admin-error-state";

describe("AdminErrorState", () => {
  it("explains how to recover from a stale deployment", () => {
    const reload = vi.fn();

    render(<AdminErrorState staleDeployment onRetry={vi.fn()} onReload={reload} />);

    expect(screen.getByRole("heading", { name: "Admin was updated" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.getByText(/may need to be entered again/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload latest version" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("notes when a page draft was preserved for reload", () => {
    render(
      <AdminErrorState staleDeployment draftPreserved onRetry={vi.fn()} onReload={vi.fn()} />,
    );

    expect(screen.getByText(/unsaved page edits were kept/i)).toBeInTheDocument();
  });

  it("offers retry and reload for an ordinary route error", () => {
    const retry = vi.fn();

    render(<AdminErrorState staleDeployment={false} onRetry={retry} onReload={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
