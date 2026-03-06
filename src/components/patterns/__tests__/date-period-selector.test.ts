import { describe, it, expect } from "vitest";
import {
  getDateRangeFromPeriod,
  getDefaultDatePeriod,
  injectDateFilters,
  type DatePeriodValue,
  type DatePeriodInputValue,
} from "../date-period-selector";

describe("getDefaultDatePeriod", () => {
  it("returns a preset period with from at start of day and to at end of day", () => {
    const period = getDefaultDatePeriod();

    expect(period.type).toBe("preset");
    expect(period.from.getHours()).toBe(0);
    expect(period.from.getMinutes()).toBe(0);
    expect(period.from.getSeconds()).toBe(0);
    expect(period.from.getMilliseconds()).toBe(0);

    expect(period.to.getHours()).toBe(23);
    expect(period.to.getMinutes()).toBe(59);
    expect(period.to.getSeconds()).toBe(59);
    expect(period.to.getMilliseconds()).toBe(999);
  });

  it("returns a 30-day range", () => {
    const period = getDefaultDatePeriod();
    const fromDate = new Date(period.from.getFullYear(), period.from.getMonth(), period.from.getDate());
    const toDate = new Date(period.to.getFullYear(), period.to.getMonth(), period.to.getDate());
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});

describe("getDateRangeFromPeriod", () => {
  it("returns UTC ISO strings with Z suffix for string date inputs", () => {
    const input: DatePeriodInputValue = {
      type: "range",
      from: "2025-12-01",
      to: "2025-12-31",
      label: "2025-12-01 ~ 2025-12-31",
    };

    const result = getDateRangeFromPeriod(input);

    expect(result.from).toBe("2025-12-01T00:00:00.000Z");
    expect(result.to).toBe("2025-12-31T23:59:59.999Z");
  });

  it("returns UTC ISO strings with Z suffix for Date object inputs", () => {
    const input: DatePeriodValue = {
      type: "range",
      from: new Date(2026, 1, 1), // Feb 1, 2026
      to: new Date(2026, 1, 28), // Feb 28, 2026
      label: "2026.02.01 - 2026.02.28",
    };

    const result = getDateRangeFromPeriod(input);

    expect(result.from).toBe("2026-02-01T00:00:00.000Z");
    expect(result.to).toBe("2026-02-28T23:59:59.999Z");
  });

  it("preserves date values regardless of timezone for month type", () => {
    const input: DatePeriodInputValue = {
      type: "month",
      from: "2025-06-01",
      to: "2025-06-30",
      label: "2025년 6월",
    };

    const result = getDateRangeFromPeriod(input);

    expect(result.from).toBe("2025-06-01T00:00:00.000Z");
    expect(result.to).toBe("2025-06-30T23:59:59.999Z");
  });

  it("handles end-of-year dates correctly", () => {
    const input: DatePeriodInputValue = {
      type: "range",
      from: "2025-12-25",
      to: "2025-12-31",
      label: "2025-12-25 ~ 2025-12-31",
    };

    const result = getDateRangeFromPeriod(input);

    expect(result.from).toBe("2025-12-25T00:00:00.000Z");
    expect(result.to).toBe("2025-12-31T23:59:59.999Z");
  });

  it("falls back to default 30-day period for invalid input", () => {
    const result = getDateRangeFromPeriod(undefined);

    expect(result.from).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\.999Z$/);
  });

  it("falls back to default for null input", () => {
    const result = getDateRangeFromPeriod(null);

    expect(result.from).toMatch(/T00:00:00\.000Z$/);
    expect(result.to).toMatch(/T23:59:59\.999Z$/);
  });

  it("falls back to default for malformed objects", () => {
    const result = getDateRangeFromPeriod({ type: "range", from: "invalid" });

    expect(result.from).toMatch(/T00:00:00\.000Z$/);
    expect(result.to).toMatch(/T23:59:59\.999Z$/);
  });
});

describe("injectDateFilters", () => {
  it("replaces DATE_FROM and DATE_TO placeholders in query template", () => {
    const template = `query {
      data(
        filters: [
          { field: "created_at", operator: GTE, value: "{{DATE_FROM}}" },
          { field: "created_at", operator: LTE, value: "{{DATE_TO}}" }
        ]
      ) { count }
    }`;

    const period: DatePeriodInputValue = {
      type: "range",
      from: "2025-12-01",
      to: "2025-12-31",
      label: "test",
    };

    const result = injectDateFilters(template, period);

    expect(result).toContain('"2025-12-01T00:00:00.000Z"');
    expect(result).toContain('"2025-12-31T23:59:59.999Z"');
    expect(result).not.toContain("{{DATE_FROM}}");
    expect(result).not.toContain("{{DATE_TO}}");
  });

  it("replaces multiple occurrences of placeholders", () => {
    const template = `"{{DATE_FROM}}" and "{{DATE_FROM}}" to "{{DATE_TO}}"`;
    const period: DatePeriodInputValue = {
      type: "range",
      from: "2025-01-01",
      to: "2025-01-31",
      label: "test",
    };

    const result = injectDateFilters(template, period);

    const fromCount = (result.match(/2025-01-01T00:00:00\.000Z/g) || [])
      .length;
    expect(fromCount).toBe(2);
  });

  it("uses default period when no period provided", () => {
    const template = `"{{DATE_FROM}}" to "{{DATE_TO}}"`;
    const result = injectDateFilters(template);

    expect(result).not.toContain("{{DATE_FROM}}");
    expect(result).not.toContain("{{DATE_TO}}");
    expect(result).toMatch(/T00:00:00\.000Z/);
    expect(result).toMatch(/T23:59:59\.999Z/);
  });
});
