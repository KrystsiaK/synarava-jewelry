import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChips } from "../filter-chips";

const categories = [{ value: "bracelets", label: "Bracelets" }];
const collections = [{ value: "heritage", label: "Heritage" }];
const tags = [{ value: "oak", label: "Oak Wood" }];

function setup(filters: Parameters<typeof FilterChips>[0]["filters"]) {
  const onRemove = vi.fn();
  const onClearAll = vi.fn();
  render(
    <FilterChips
      filters={filters}
      categories={categories}
      collections={collections}
      tags={tags}
      onRemove={onRemove}
      onClearAll={onClearAll}
    />,
  );
  return { onRemove, onClearAll };
}

describe("FilterChips", () => {
  it("renders nothing when no active filters", () => {
    const { container } = render(
      <FilterChips filters={{}} categories={[]} collections={[]} tags={[]} onRemove={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a chip for a search query", () => {
    setup({ q: "oak" });
    expect(screen.getByText(/"oak"/)).toBeInTheDocument();
  });

  it("renders a chip for a category filter using the option label", () => {
    setup({ category: "bracelets" });
    expect(screen.getByText("Bracelets")).toBeInTheDocument();
  });

  it("renders a chip for a collection filter", () => {
    setup({ collection: "heritage" });
    expect(screen.getByText("Heritage")).toBeInTheDocument();
  });

  it("renders a chip for a tag filter", () => {
    setup({ tag: "oak" });
    expect(screen.getByText("Oak Wood")).toBeInTheDocument();
  });

  it("renders multiple chips", () => {
    setup({ category: "bracelets", tag: "oak" });
    expect(screen.getByText("Bracelets")).toBeInTheDocument();
    expect(screen.getByText("Oak Wood")).toBeInTheDocument();
  });

  it("calls onRemove with the correct key when X is clicked", async () => {
    const user = userEvent.setup();
    const { onRemove } = setup({ category: "bracelets" });
    await user.click(screen.getByRole("button", { name: /remove filter bracelets/i }));
    expect(onRemove).toHaveBeenCalledWith("category");
  });

  it("shows Clear all button when multiple filters active", () => {
    setup({ category: "bracelets", tag: "oak" });
    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
  });

  it("does not show Clear all when only one filter", () => {
    setup({ category: "bracelets" });
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("calls onClearAll when Clear all is clicked", async () => {
    const user = userEvent.setup();
    const { onClearAll } = setup({ category: "bracelets", tag: "oak" });
    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("falls back to raw value when option label not found", () => {
    setup({ category: "unknown-slug" });
    expect(screen.getByText("unknown-slug")).toBeInTheDocument();
  });
});
