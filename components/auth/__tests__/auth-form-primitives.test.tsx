import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AuthForm,
  AuthField,
  AuthInput,
  AuthTextarea,
  AuthMessage,
} from "../auth-form-primitives";

describe("AuthForm", () => {
  it("renders children in a form", () => {
    render(<AuthForm action={vi.fn()}>Form content</AuthForm>);
    expect(screen.getByText("Form content")).toBeInTheDocument();
    expect(screen.getByText("Form content").closest("form")).toBeInTheDocument();
  });

  it("merges custom className", () => {
    const { container } = render(
      <AuthForm action={vi.fn()} className="max-w-sm">
        content
      </AuthForm>,
    );
    expect(container.querySelector("form")).toHaveClass("max-w-sm");
  });
});

describe("AuthField", () => {
  it("renders label and children", () => {
    render(
      <AuthField label="Email">
        <input type="email" />
      </AuthField>,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("wraps in a label element", () => {
    const { container } = render(
      <AuthField label="Email">
        <input type="email" />
      </AuthField>,
    );
    expect(container.querySelector("label")).toBeInTheDocument();
  });

  it("label span has label-caps class", () => {
    render(
      <AuthField label="Email">
        <input type="email" />
      </AuthField>,
    );
    expect(screen.getByText("Email")).toHaveClass("label-caps");
  });
});

describe("AuthInput", () => {
  it("renders input element", () => {
    render(<AuthInput type="email" placeholder="you@example.com" />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("accepts typing", async () => {
    const user = userEvent.setup();
    render(<AuthInput type="text" />);
    const input = screen.getByRole("textbox");
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("forwards className", () => {
    render(<AuthInput className="custom" />);
    const input = document.querySelector("input")!;
    expect(input).toHaveClass("custom");
  });
});

describe("AuthTextarea", () => {
  it("renders textarea element", () => {
    render(<AuthTextarea placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Notes").tagName).toBe("TEXTAREA");
  });

  it("accepts typing", async () => {
    const user = userEvent.setup();
    render(<AuthTextarea />);
    const ta = screen.getByRole("textbox");
    await user.type(ta, "Hello world");
    expect(ta).toHaveValue("Hello world");
  });
});

describe("AuthMessage", () => {
  it("renders nothing when no error or success", () => {
    const { container } = render(<AuthMessage />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders error message", () => {
    render(<AuthMessage error="Invalid credentials" />);
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("renders success message", () => {
    render(<AuthMessage success="Password reset sent" />);
    expect(screen.getByText("Password reset sent")).toBeInTheDocument();
  });

  it("prioritises error over success when both provided", () => {
    render(<AuthMessage error="Oops" success="Done" />);
    expect(screen.getByText("Oops")).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("error uses red-tinted border class", () => {
    const { container } = render(<AuthMessage error="Oops" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/border-\[/);
  });
});
