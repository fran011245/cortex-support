import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LoadingSplash } from "./LoadingSplash";

vi.mock("@/assets/cortex-logo.svg", () => ({ default: "cortex-logo.svg" }));

describe("LoadingSplash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders brand elements immediately", () => {
    render(<LoadingSplash onDone={vi.fn()} />);
    expect(screen.getByText("CORTEX")).toBeInTheDocument();
    expect(screen.getByText(/Support Co-Pilot/i)).toBeInTheDocument();
    expect(screen.getByText(/Initializing/i)).toBeInTheDocument();
    expect(screen.getByAltText("Cortex")).toBeInTheDocument();
  });

  it("starts fully visible (opacity-100)", () => {
    const { container } = render(<LoadingSplash onDone={vi.fn()} />);
    expect(container.firstChild).toHaveClass("opacity-100");
  });

  it("does not call onDone before 2100ms", () => {
    const onDone = vi.fn();
    render(<LoadingSplash onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(2099); });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("calls onDone exactly once at 2100ms", () => {
    const onDone = vi.fn();
    render(<LoadingSplash onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(2100); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("begins fading at 1700ms", () => {
    const { container } = render(<LoadingSplash onDone={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(1700); });
    expect(container.firstChild).toHaveClass("opacity-0");
    expect(container.firstChild).toHaveClass("pointer-events-none");
  });

  it("is still visible just before 1700ms", () => {
    const { container } = render(<LoadingSplash onDone={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(1699); });
    expect(container.firstChild).toHaveClass("opacity-100");
  });

  it("does not call onDone again if parent re-renders during splash", () => {
    const onDone = vi.fn();
    const { rerender } = render(<LoadingSplash onDone={onDone} />);
    // Simulate parent re-render with a new function reference (the bug we fixed)
    rerender(<LoadingSplash onDone={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(2100); });
    // Should still only call the original onDone once (via ref)
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("cleans up timers on unmount", () => {
    const onDone = vi.fn();
    const { unmount } = render(<LoadingSplash onDone={onDone} />);
    unmount();
    act(() => { vi.advanceTimersByTime(2100); });
    expect(onDone).not.toHaveBeenCalled();
  });
});
