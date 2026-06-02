import { render, screen, act } from "@testing-library/react";
import { ScrollReveal } from "../scroll-reveal";

type MockObserver = {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  _cb: IntersectionObserverCallback;
};

function getLastObserver(): MockObserver {
  const calls = (global.IntersectionObserver as ReturnType<typeof vi.fn>).mock.results;
  return calls[calls.length - 1].value as MockObserver;
}

describe("ScrollReveal", () => {
  it("renders children", () => {
    render(<ScrollReveal>Reveal me</ScrollReveal>);
    expect(screen.getByText("Reveal me")).toBeInTheDocument();
  });

  it("applies scroll-reveal class", () => {
    const { container } = render(<ScrollReveal>content</ScrollReveal>);
    expect(container.firstChild).toHaveClass("scroll-reveal");
  });

  it("applies default direction class (up)", () => {
    const { container } = render(<ScrollReveal>content</ScrollReveal>);
    expect(container.firstChild).toHaveClass("scroll-reveal--up");
  });

  it("applies specified direction class", () => {
    const { container } = render(<ScrollReveal direction="left">content</ScrollReveal>);
    expect(container.firstChild).toHaveClass("scroll-reveal--left");
  });

  it("applies direction none", () => {
    const { container } = render(<ScrollReveal direction="none">content</ScrollReveal>);
    expect(container.firstChild).toHaveClass("scroll-reveal--none");
  });

  it("applies delay as inline style", () => {
    const { container } = render(<ScrollReveal delay={200}>content</ScrollReveal>);
    expect((container.firstChild as HTMLElement).style.transitionDelay).toBe("200ms");
  });

  it("does not apply transitionDelay when delay is 0", () => {
    const { container } = render(<ScrollReveal delay={0}>content</ScrollReveal>);
    expect((container.firstChild as HTMLElement).style.transitionDelay).toBe("");
  });

  it("sets up IntersectionObserver on mount", () => {
    render(<ScrollReveal>content</ScrollReveal>);
    expect(global.IntersectionObserver).toHaveBeenCalled();
    expect(getLastObserver().observe).toHaveBeenCalled();
  });

  it("adds in-view class when element intersects", () => {
    const { container } = render(<ScrollReveal>content</ScrollReveal>);
    const el = container.firstChild as Element;
    const observer = getLastObserver();

    act(() => {
      observer._cb(
        [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(el).toHaveClass("in-view");
  });

  it("calls unobserve after intersection", () => {
    const { container } = render(<ScrollReveal>content</ScrollReveal>);
    const el = container.firstChild as Element;
    const observer = getLastObserver();

    act(() => {
      observer._cb(
        [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(observer.unobserve).toHaveBeenCalledWith(el);
  });

  it("does not add in-view class when not intersecting", () => {
    const { container } = render(<ScrollReveal>content</ScrollReveal>);
    const el = container.firstChild as Element;
    const observer = getLastObserver();

    act(() => {
      observer._cb(
        [{ isIntersecting: false, target: el } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(el).not.toHaveClass("in-view");
  });

  it("disconnects observer on unmount", () => {
    const { unmount } = render(<ScrollReveal>content</ScrollReveal>);
    const observer = getLastObserver();
    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("merges custom className", () => {
    const { container } = render(<ScrollReveal className="col-span-12">content</ScrollReveal>);
    expect(container.firstChild).toHaveClass("col-span-12");
  });
});
