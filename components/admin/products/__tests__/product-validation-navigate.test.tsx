import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useAdminFormValidation } from "@/components/admin/shared/admin-form-validation";
import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import {
  requestProductSaveWithValidation,
  revealProductFieldErrors,
} from "@/components/admin/products/product-validation-navigate";
import type { ProductFieldName } from "@/lib/products/product-form-validation";

function Harness() {
  const formRef = useRef<HTMLFormElement>(null);
  const validation = useAdminFormValidation<ProductFieldName>({ formRef });
  const [section, setSection] = useState<ProductEditorSection>("media");
  const [locale, setLocale] = useState("pt");
  const [saved, setSaved] = useState(false);

  return (
    <form ref={formRef} aria-label="Product harness" noValidate>
      <p data-testid="section">{section}</p>
      <p data-testid="locale">{locale}</p>
      {saved ? <p data-testid="saved">saved</p> : null}

      <div hidden={section !== "essentials"}>
        <label htmlFor={validation.fieldId("name")}>Title</label>
        <input name="name" required defaultValue="" {...validation.fieldProps("name")} />
        {validation.fieldErrors.name ? <p>{validation.fieldErrors.name}</p> : null}

        <label htmlFor={validation.fieldId("slug")}>Slug</label>
        <input name="slug" required defaultValue="" {...validation.fieldProps("slug")} />
      </div>

      <div hidden={section !== "price"}>
        <label htmlFor={validation.fieldId("price")}>Price</label>
        <input name="price" required defaultValue="" {...validation.fieldProps("price")} />
        {validation.fieldErrors.price ? <p>{validation.fieldErrors.price}</p> : null}
      </div>

      <div hidden={section !== "inventory"}>
        <label htmlFor={validation.fieldId("sku")}>SKU</label>
        <input name="sku" required defaultValue="" {...validation.fieldProps("sku")} />
        {validation.fieldErrors.sku ? <p>{validation.fieldErrors.sku}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => {
          requestProductSaveWithValidation(
            {
              form: formRef.current,
              validation,
              setActiveSection: setSection,
              activeLocale: locale,
              selectLocale: setLocale,
            },
            () => setSaved(true),
          );
        }}
      >
        Save
      </button>

      <button
        type="button"
        onClick={() => {
          revealProductFieldErrors(
            {
              validation,
              setActiveSection: setSection,
              activeLocale: locale,
              selectLocale: setLocale,
            },
            { price: "Enter a price greater than 0.", sku: "Enter an SKU." },
          );
        }}
      >
        Server price+sku
      </button>
    </form>
  );
}

describe("product validation navigate", () => {
  it("opens the Product tab and focuses Title when several required fields are empty", async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByTestId("section")).toHaveTextContent("essentials");
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    await waitFor(() => {
      expect(screen.getByLabelText("Title")).toHaveFocus();
    });
    expect(screen.queryByTestId("saved")).not.toBeInTheDocument();
  });

  it("after fixing Title/Slug, next Save opens Price and focuses price", async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveFocus());

    await user.type(screen.getByLabelText("Title"), "Lava ring");
    await user.type(screen.getByLabelText("Slug"), "lava-ring");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByTestId("section")).toHaveTextContent("price");
    await waitFor(() => {
      expect(screen.getByLabelText("Price")).toHaveFocus();
    });
  });

  it("server errors prefer Price over Inventory in visual tab order", async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Server price+sku" }));

    expect(screen.getByTestId("section")).toHaveTextContent("price");
    await waitFor(() => {
      expect(screen.getByLabelText("Price")).toHaveFocus();
    });
  });

  it("opens the confirm path when the commerce core is valid", async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<Harness />);

    // Fill every required control while its tab is open (same as a merchant).
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("section")).toHaveTextContent("essentials"));
    await user.type(screen.getByLabelText("Title"), "Lava ring");
    await user.type(screen.getByLabelText("Slug"), "lava-ring");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("section")).toHaveTextContent("price"));
    const price = screen.getByLabelText("Price");
    await user.clear(price);
    await user.type(price, "120");
    expect(price).toHaveValue("120");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("section")).toHaveTextContent("inventory"));
    const sku = screen.getByLabelText("SKU");
    await user.clear(sku);
    await user.type(sku, "LR-1");
    expect(sku).toHaveValue("LR-1");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByTestId("saved")).toBeInTheDocument();
  });
});
