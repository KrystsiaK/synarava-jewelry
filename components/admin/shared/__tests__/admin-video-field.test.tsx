import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminHelp, AdminVideoField } from "@/components/synarava-cms";

describe("AdminVideoField", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:video-preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("composes AdminFieldShell with a video file control", () => {
    render(
      <AdminVideoField
        id="home-beads"
        name="homeBeads"
        label="Home — beads"
        help={<AdminHelp>First video in the home-page hero rotation.</AdminHelp>}
        currentVideoUrl="/media/uploads/videos/homeBeads/demo.mp4"
      />,
    );

    const input = document.getElementById("home-beads");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("name", "homeBeads");
    expect(screen.getByText("Current video")).toBeInTheDocument();
    expect(screen.getByText("/media/uploads/videos/homeBeads/demo.mp4")).toBeInTheDocument();
  });

  it("shows an empty placeholder when no video is stored", () => {
    render(<AdminVideoField name="homeModel" label="Home — model" />);
    expect(screen.getByText("No video uploaded")).toBeInTheDocument();
  });

  it("previews a newly selected MP4 and can clear it", async () => {
    const user = userEvent.setup();
    render(<AdminVideoField id="bracelet-film" name="braceletFilm" label="Bracelet film" />);

    const input = document.getElementById("bracelet-film") as HTMLInputElement;
    const file = new File(["fake-video"], "bracelet.mp4", { type: "video/mp4" });
    await user.upload(input, file);

    expect(screen.getByText("Selected video")).toBeInTheDocument();
    expect(screen.getByText("bracelet.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear selected video" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear selected video" }));
    expect(screen.queryByText("Selected video")).not.toBeInTheDocument();
    expect(screen.getByText("No video uploaded")).toBeInTheDocument();
  });

  it("marks the current video for removal via a hidden flag", async () => {
    const user = userEvent.setup();
    render(
      <AdminVideoField
        id="home-beads-remove"
        name="homeBeads"
        label="Home — beads"
        currentVideoUrl="/media/uploads/videos/homeBeads/demo.mp4"
        removeFieldName="remove_homeBeads"
      />,
    );

    const removeFlag = document.querySelector('input[name="remove_homeBeads"]') as HTMLInputElement;
    expect(removeFlag).toHaveAttribute("value", "0");

    await user.click(screen.getByRole("button", { name: "Remove current video" }));
    expect(removeFlag).toHaveAttribute("value", "1");
    expect(screen.getByText("Current video will be removed after save")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo remove" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo remove" }));
    expect(removeFlag).toHaveAttribute("value", "0");
    expect(screen.queryByText("Current video will be removed after save")).not.toBeInTheDocument();
  });
});
