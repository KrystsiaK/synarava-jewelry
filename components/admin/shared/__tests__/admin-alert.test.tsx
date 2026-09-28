import { render, screen } from "@testing-library/react";

import { AdminAlert } from "../admin-alert";

describe("AdminAlert", () => {
  it("renders nothing when there is no message", () => {
    const { container } = render(<AdminAlert />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an error in the shared danger chrome", () => {
    render(<AdminAlert message="Publish the page before opening the editor." />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("adm-alert", "adm-alert--error");
    expect(alert).toHaveTextContent("Publish the page before opening the editor.");
    expect(alert.querySelector(".adm-alert__text")).toHaveTextContent(
      "Publish the page before opening the editor.",
    );
  });

  it("renders success as a status, not an alert", () => {
    render(<AdminAlert tone="success" message="Saved." />);

    const status = screen.getByRole("status");
    expect(status).toHaveClass("adm-alert--success");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
