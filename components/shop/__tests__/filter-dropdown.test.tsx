import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterDropdown } from "../filter-dropdown";

const options = [
  { value: "bracelets", label: "Bracelets" },
  { value: "necklaces", label: "Necklaces" },
  { value: "rings", label: "Rings" },
];

function setup(props?: Partial<Parameters<typeof FilterDropdown>[0]>) {
  const onChange = vi.fn();
  const utils = render(
    <FilterDropdown
      label="Category"
      options={options}
      value=""
      onChange={onChange}
      {...props}
    />,
  );
  return { ...utils, onChange };
}

describe("FilterDropdown", () => {
  it("renders the label button", () => {
    setup();
    expect(screen.getByRole("button", { name: /category/i })).toBeInTheDocument();
  });

  it("is closed by default", () => {
    setup();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens on click", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("shows all options plus the 'all' option when open", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(screen.getByRole("option", { name: "All category" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bracelets" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Necklaces" })).toBeInTheDocument();
  });

  it("calls onChange with the selected value", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("button", { name: /category/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));
    expect(onChange).toHaveBeenCalledWith("bracelets");
  });

  it("closes after selecting an option", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /category/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("calls onChange with empty string when 'all' option is selected", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: "bracelets" });
    await user.click(screen.getByRole("button", { name: /bracelets/i }));
    await user.click(screen.getByRole("option", { name: "All category" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows checkmark next to the selected option", async () => {
    const user = userEvent.setup();
    setup({ value: "necklaces" });
    await user.click(screen.getByRole("button", { name: /necklaces/i }));
    const listbox = screen.getByRole("listbox");
    const necklacesOption = within(listbox).getByRole("option", { name: "Necklaces" });
    expect(necklacesOption).toHaveAttribute("aria-selected", "true");
  });

  it("shows active dot indicator when a value is set", () => {
    setup({ value: "rings" });
    // The button should contain the active dot
    const btn = screen.getByRole("button");
    expect(btn.querySelector("[class*='bg-accent']")).toBeInTheDocument();
  });

  it("does not show active dot when no value", () => {
    setup({ value: "" });
    const btn = screen.getByRole("button");
    expect(btn.querySelector("[class*='bg-accent']")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes when a scroll event is dispatched", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    window.dispatchEvent(new Event("scroll", { bubbles: true }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("button is disabled when disabled prop is true", () => {
    setup({ disabled: true });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows 'No options' when options array is empty", async () => {
    const user = userEvent.setup();
    setup({ options: [] });
    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(screen.getByText("No options")).toBeInTheDocument();
  });

  it("uses custom allLabel prop", async () => {
    const user = userEvent.setup();
    setup({ allLabel: "Everything" });
    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(screen.getByRole("option", { name: "Everything" })).toBeInTheDocument();
  });
});
