import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "../theme-provider";

function ThemeConsumer() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setPreference("dark")}>Set Dark</button>
      <button onClick={() => setPreference("light")}>Set Light</button>
      <button onClick={() => setPreference("system")}>Set System</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("provides initial preference to consumers", () => {
    render(
      <ThemeProvider initialPreference="light">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("pref")).toHaveTextContent("light");
  });

  it("provides initial dark preference", () => {
    render(
      <ThemeProvider initialPreference="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("pref")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("updates preference on setPreference", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider initialPreference="light">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Set Dark" }));
    expect(screen.getByTestId("pref")).toHaveTextContent("dark");
  });

  it("resolves system preference to light when matchMedia is false", () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(
      <ThemeProvider initialPreference="system">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("resolves system preference to dark when matchMedia matches dark", () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(
      <ThemeProvider initialPreference="system">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("sets data-theme on documentElement when preference changes", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider initialPreference="light">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Set Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("renders children", () => {
    render(
      <ThemeProvider initialPreference="light">
        <p>child content</p>
      </ThemeProvider>,
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});

describe("useTheme", () => {
  it("throws when used outside ThemeProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useTheme();
      return null;
    }
    expect(() => render(<Bad />)).toThrow("useTheme must be used within ThemeProvider.");
    spy.mockRestore();
  });
});
