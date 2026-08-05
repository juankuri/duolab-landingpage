import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce } from "../src/scripts/admin/debounce.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debounce", () => {
  it("calls fn once after the delay, not on every call", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 250);

    debounced();
    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("restarts the delay on each call (trailing edge only)", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 250);

    debounced();
    vi.advanceTimersByTime(200);
    debounced(); // resets the clock before the first call fires
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes the latest call's arguments through", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledExactlyOnceWith("second");
  });

  it("cancel() suppresses a pending call", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() on an already-idle debounce is a no-op, not an error", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    expect(() => debounced.cancel()).not.toThrow();
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
