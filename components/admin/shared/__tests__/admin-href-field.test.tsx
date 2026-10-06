import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
}));

vi.mock("@/app/admin/actions/storefront-href", () => ({
  searchStorefrontHrefsAction: mocks.search,
}));

import { AdminHrefField } from "@/components/synarava-cms";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search.mockResolvedValue({
    segments: [
      {
        id: "routes",
        label: "Routes",
        hits: [
          {
            id: "route:home",
            segment: "routes",
            label: "Home",
            href: "/",
            detail: "/",
          },
          {
            id: "route:shop",
            segment: "routes",
            label: "Shop",
            href: "/shop",
            detail: "/shop",
          },
        ],
      },
    ],
  });
});

describe("AdminHrefField", () => {
  it("preserves the committed href in a hidden input", () => {
    const { container } = render(
      <AdminHrefField label="CTA href" name="ctaHref" defaultValue="/shop" />,
    );

    expect(screen.getByRole("combobox", { name: /CTA href/i })).toHaveValue("/shop");
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="ctaHref"]')).toHaveValue("/shop");
  });

  it("shows Routes on empty focus and writes the selected path", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AdminHrefField label="CTA href" name="ctaHref" defaultValue="" />,
    );

    await user.click(screen.getByRole("combobox", { name: /CTA href/i }));
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith(""));
    expect(await screen.findByRole("group", { name: "Routes" })).toBeInTheDocument();

    await user.click(await screen.findByRole("option", { name: /Shop/ }));

    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="ctaHref"]')).toHaveValue("/shop");
    expect(screen.getByRole("combobox", { name: /CTA href/i })).toHaveValue("/shop");
  });

  it("offers a custom path when the query looks like a path", async () => {
    mocks.search.mockResolvedValue({
      segments: [
        {
          id: "custom",
          label: "Use custom path",
          hits: [
            {
              id: "custom:/promo",
              segment: "custom",
              label: "Use custom path",
              href: "/promo",
              detail: "/promo",
            },
          ],
        },
      ],
    });
    const user = userEvent.setup();
    const { container } = render(
      <AdminHrefField label="CTA href" name="ctaHref" defaultValue="" />,
    );

    await user.type(screen.getByRole("combobox", { name: /CTA href/i }), "/promo");
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith("/promo"));
    await user.click(await screen.findByRole("option", { name: /Use custom path/ }));

    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="ctaHref"]')).toHaveValue("/promo");
  });

  it("uses the same field-group chrome as other synarava-cms inputs", () => {
    const { container } = render(
      <AdminHrefField label="CTA href" name="ctaHref" defaultValue="/shop" />,
    );

    expect(container.querySelector("[data-component='AdminHrefField']")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='control-group']")).toHaveClass("adm-field-group");
  });

  it("opens the result list as an adm-popover above field chrome", async () => {
    const user = userEvent.setup();
    render(<AdminHrefField label="CTA href" name="ctaHref" defaultValue="" />);

    await user.click(screen.getByRole("combobox", { name: /CTA href/i }));
    const listbox = await screen.findByRole("listbox");
    expect(listbox).toHaveClass("adm-popover");
    expect(listbox).toHaveAttribute("data-slot", "href-popover");
    expect(listbox.className).not.toMatch(/\bz-20\b/);
  });

  it("portals the listbox outside overflow-clipped collapsible ancestors", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div className="admin-terminal">
        <div className="adm-collapse" data-open="true" style={{ overflow: "clip" }}>
          <div className="adm-collapse__clip" style={{ overflow: "hidden" }}>
            <AdminHrefField label="CTA href" name="ctaHref" defaultValue="" />
          </div>
        </div>
      </div>,
    );

    await user.click(screen.getByRole("combobox", { name: /CTA href/i }));
    const listbox = await screen.findByRole("listbox");

    expect(listbox).toHaveClass("adm-popover");
    expect(listbox.style.position).toBe("fixed");
    expect(container.querySelector(".adm-collapse__clip")?.contains(listbox)).toBe(false);
    expect(container.querySelector(".admin-terminal")?.contains(listbox)).toBe(true);
    expect(await screen.findByRole("option", { name: /Shop/ })).toBeInTheDocument();
  });

  it("shows an orange warning when the selected target is draft", async () => {
    mocks.search.mockResolvedValue({
      segments: [
        {
          id: "collections",
          label: "Collections",
          hits: [
            {
              id: "collection:1",
              segment: "collections",
              label: "Jewellery",
              href: "/collections/jewellery",
              status: "DRAFT",
              detail: "/collections/jewellery · draft",
            },
          ],
        },
      ],
    });
    const user = userEvent.setup();
    const { container } = render(
      <AdminHrefField label="CTA href" name="ctaHref" defaultValue="" />,
    );

    await user.type(screen.getByRole("combobox", { name: /CTA href/i }), "jewelle");
    await waitFor(() => expect(mocks.search).toHaveBeenCalled());
    await user.click(await screen.findByRole("option", { name: /Jewellery/ }));

    await waitFor(() => {
      expect(container.querySelector("[data-component='AdminFieldWarning']")).toHaveTextContent(
        /draft/i,
      );
    });
    expect(container.querySelector("[data-slot='control-group']")).toHaveClass("adm-field-group--warning");
  });

  it("marks a path with no matching target as an error (deleted destination)", async () => {
    mocks.search.mockResolvedValue({
      segments: [
        {
          id: "custom",
          label: "Use custom path",
          hits: [
            {
              id: "custom:/gone",
              segment: "custom",
              label: "Use custom path",
              href: "/gone",
              detail: "/gone",
            },
          ],
        },
      ],
    });

    const { container } = render(
      <AdminHrefField label="CTA href" name="ctaHref" defaultValue="/gone" />,
    );

    await waitFor(() => {
      expect(container.querySelector("[data-component='AdminFieldError']")).toHaveTextContent(
        /nowhere|deleted/i,
      );
    });
  });

  it("accepts locale-prefixed paths that match a real route and stores locale-free", async () => {
    mocks.search.mockResolvedValue({
      segments: [
        {
          id: "routes",
          label: "Routes",
          hits: [
            {
              id: "route:shop",
              segment: "routes",
              label: "Shop",
              href: "/shop",
              detail: "/pt/shop",
            },
          ],
        },
      ],
    });

    const user = userEvent.setup();
    const { container } = render(
      <AdminHrefField label="CTA href" name="ctaHref" locale="pt" defaultValue="" />,
    );

    await user.type(screen.getByRole("combobox", { name: /CTA href/i }), "/pt/shop");
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith("/pt/shop"));
    await user.click(await screen.findByRole("option", { name: /Shop/ }));

    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="ctaHref"]')).toHaveValue(
      "/shop",
    );
    expect(container.querySelector("[data-component='AdminFieldError']")).toBeNull();
  });

  it("normalizes a locale-prefixed default and does not flag it as missing", async () => {
    mocks.search.mockResolvedValue({
      segments: [
        {
          id: "routes",
          label: "Routes",
          hits: [
            {
              id: "route:shop",
              segment: "routes",
              label: "Shop",
              href: "/shop",
              detail: "/pt/shop",
            },
          ],
        },
      ],
    });

    const { container } = render(
      <AdminHrefField label="CTA href" name="ctaHref" locale="pt" defaultValue="/pt/shop" />,
    );

    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="ctaHref"]')).toHaveValue(
      "/shop",
    );
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith("/shop"));
    expect(container.querySelector("[data-component='AdminFieldError']")).toBeNull();
  });
});
