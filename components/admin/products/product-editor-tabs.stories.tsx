import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  ProductEditorTabs,
  type ProductEditorSection,
} from "@/components/admin/products/product-editor-tabs";

function Editor() {
  const [active, setActive] = useState<ProductEditorSection>("essentials");

  return (
    <ProductEditorTabs active={active} onChange={setActive}>
      <div className="adm-inset-x py-6 text-sm text-[var(--adm-muted)]">Section fields</div>
    </ProductEditorTabs>
  );
}

const meta = {
  title: "synarava-cms/ProductEditorTabs",
  component: ProductEditorTabs,
  decorators: [
    (Story) => (
      <div className="admin-terminal admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-panel)]">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ProductEditorTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    active: "essentials",
    onChange: () => {},
  },
  render: () => <Editor />,
};
