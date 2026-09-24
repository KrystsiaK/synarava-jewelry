import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { AdminOrderedList } from "@/components/synarava-cms";

function Harness({ initial = ["a", "b", "c"] }: { initial?: string[] }) {
  const [items, setItems] = useState(initial);
  return (
    <AdminOrderedList
      label="Slots"
      name="slotIds"
      items={items}
      onChange={setItems}
      getKey={(item, index) => `${item}-${index}`}
      getValue={(item) => item}
      minItems={1}
      createItem={() => ""}
      addLabel="Add slot"
      renderItem={(item, { index }) => (
        <span data-testid={`slot-${index}`}>{item || "(empty)"}</span>
      )}
    />
  );
}

describe("AdminOrderedList", () => {
  it("reorders with up/down and keeps a minimum of one row", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByTestId("slot-0")).toHaveTextContent("a");
    await user.click(screen.getAllByRole("button", { name: "Move down" })[0]!);
    expect(screen.getByTestId("slot-0")).toHaveTextContent("b");
    expect(screen.getByTestId("slot-1")).toHaveTextContent("a");

    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(screen.getAllByTestId(/slot-/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });

  it("adds a row and writes hidden form values", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness initial={["x"]} />);

    await user.click(screen.getByRole("button", { name: "Add slot" }));
    expect(screen.getAllByTestId(/slot-/)).toHaveLength(2);

    const hidden = [...container.querySelectorAll('input[name="slotIds"]')].map(
      (node) => (node as HTMLInputElement).value,
    );
    expect(hidden).toEqual(["x", ""]);
  });
});
