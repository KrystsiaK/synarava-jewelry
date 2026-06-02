import type { Meta, StoryObj } from "@storybook/react";
import { FilterChips } from "./filter-chips";

const categories = [{ value: "bracelets", label: "Bracelets" }];
const collections = [{ value: "heritage", label: "Heritage Collection" }];
const tags = [{ value: "oak", label: "Oak Wood" }, { value: "lava", label: "Lava Stone" }];

const meta = {
  title: "Shop/FilterChips",
  component: FilterChips,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    categories,
    collections,
    tags,
    onRemove: () => {},
    onClearAll: () => {},
  },
} satisfies Meta<typeof FilterChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoActiveFilters: Story = {
  args: { filters: {} },
};

export const SingleFilter: Story = {
  args: { filters: { category: "bracelets" } },
};

export const WithSearch: Story = {
  args: { filters: { q: "oak bracelet" } },
};

export const MultipleFilters: Story = {
  args: { filters: { category: "bracelets", collection: "heritage", tag: "oak" } },
};

export const AllFiltersActive: Story = {
  args: { filters: { q: "carved", category: "bracelets", collection: "heritage", tag: "oak" } },
};
