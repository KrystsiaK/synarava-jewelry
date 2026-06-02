import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FilterDropdown } from "./filter-dropdown";

const options = [
  { value: "bracelets", label: "Bracelets" },
  { value: "necklaces", label: "Necklaces" },
  { value: "earrings", label: "Earrings" },
  { value: "rings", label: "Rings" },
];

function Controlled(props: Omit<Parameters<typeof FilterDropdown>[0], "value" | "onChange">) {
  const [value, setValue] = useState("");
  return <FilterDropdown {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "Shop/FilterDropdown",
  component: FilterDropdown,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex items-start gap-8 pt-4" style={{ minHeight: "16rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FilterDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

// Controlled wrapper stories
export const Default: StoryObj = {
  render: () => <Controlled label="Category" options={options} allLabel="All categories" />,
};

function WithSelectionRender() {
  const [v, setV] = useState("bracelets");
  return <FilterDropdown label="Category" options={options} value={v} onChange={setV} />;
}
export const WithSelection: StoryObj = {
  render: () => <WithSelectionRender />,
};

export const EmptyOptions: StoryObj = {
  render: () => <Controlled label="Tags" options={[]} allLabel="All tags" />,
};

export const Disabled: Story = {
  args: {
    label: "Category",
    options,
    value: "",
    onChange: () => {},
    disabled: true,
  },
};

function AllFilterTypesRender() {
  const [cat, setCat] = useState("");
  const [col, setCol] = useState("heritage");
  const [tag, setTag] = useState("");
  return (
    <div className="panel flex items-center gap-8 px-6 py-4">
      <FilterDropdown label="Categories" options={options} value={cat} onChange={setCat} allLabel="All categories" />
      <FilterDropdown label="Collections" options={[{ value: "heritage", label: "Heritage" }, { value: "earth", label: "Eco Earth" }]} value={col} onChange={setCol} allLabel="All collections" />
      <FilterDropdown label="Tags" options={[{ value: "oak", label: "Oak Wood" }, { value: "lava", label: "Lava Stone" }]} value={tag} onChange={setTag} allLabel="All tags" />
    </div>
  );
}
export const AllFilterTypes: StoryObj = {
  render: () => <AllFilterTypesRender />,
};
