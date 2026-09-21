import { render, screen } from "@testing-library/react";

import AdminError from "../error";

describe("AdminError", () => {
  it("recognizes a Server Action from an obsolete deployment", () => {
    const error = new Error("Server Action was not found on the server.");
    error.name = "UnrecognizedActionError";

    render(<AdminError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Admin was updated" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload latest version" })).toBeInTheDocument();
  });
});
