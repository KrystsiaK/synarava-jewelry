import { render, screen } from "@testing-library/react";
import { InfoList } from "../info-list";

const items = [
  { label: "Material", value: "Oak Wood" },
  { label: "Finish", value: "Matte" },
  { label: "Origin", value: "Belarus" },
];

describe("InfoList", () => {
  it("renders all items", () => {
    render(<InfoList items={items} />);
    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.getByText("Oak Wood")).toBeInTheDocument();
    expect(screen.getByText("Finish")).toBeInTheDocument();
    expect(screen.getByText("Matte")).toBeInTheDocument();
  });

  it("renders as definition list", () => {
    const { container } = render(<InfoList items={items} />);
    expect(container.querySelector("dl")).toBeInTheDocument();
    expect(container.querySelectorAll("dt")).toHaveLength(3);
    expect(container.querySelectorAll("dd")).toHaveLength(3);
  });

  it("renders ReactNode values", () => {
    const richItems = [{ label: "Price", value: <strong>€240</strong> }];
    render(<InfoList items={richItems} />);
    expect(screen.getByText("€240")).toBeInTheDocument();
  });

  it("renders empty list without crashing", () => {
    const { container } = render(<InfoList items={[]} />);
    expect(container.querySelector("dl")).toBeInTheDocument();
  });

  it("merges custom className onto dl", () => {
    const { container } = render(<InfoList items={items} className="mt-8" />);
    expect(container.querySelector("dl")).toHaveClass("mt-8");
  });

  it("labels use CapsLabel (label-caps class)", () => {
    render(<InfoList items={[{ label: "Material", value: "Oak" }]} />);
    expect(screen.getByText("Material")).toHaveClass("label-caps");
  });
});
