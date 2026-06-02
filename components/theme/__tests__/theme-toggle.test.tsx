import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "../theme-provider";
import { ThemeToggle } from "../theme-toggle";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider initialPreference="light">{children}</ThemeProvider>;
}

describe("ThemeToggle", () => {
  it("renders three theme buttons", () => {
    render(<ThemeToggle />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System" })).toBeInTheDocument();
  });

  it("marks active button with aria-pressed=true", () => {
    render(<ThemeToggle />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  });

  it("changes preference when another option is clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />, { wrapper: Wrapper });
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows labels in normal mode", () => {
    render(<ThemeToggle />, { wrapper: Wrapper });
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("hides labels in compact mode", () => {
    render(<ThemeToggle compact />, { wrapper: Wrapper });
    expect(screen.queryByText("Light")).not.toBeInTheDocument();
    expect(screen.queryByText("Dark")).not.toBeInTheDocument();
  });
});
