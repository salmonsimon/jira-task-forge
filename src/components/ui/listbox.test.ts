import { describe, expect, it } from "vitest";
import { getNextListboxOptionValue } from "./listbox";

describe("getNextListboxOptionValue", () => {
  it("moves through options in both directions and wraps at the ends", () => {
    const options = ["Highest", "High", "Medium", "Low", "Lowest"];

    expect(getNextListboxOptionValue(options, "Medium", 1)).toBe("Low");
    expect(getNextListboxOptionValue(options, "Medium", -1)).toBe("High");
    expect(getNextListboxOptionValue(options, "Lowest", 1)).toBe("Highest");
    expect(getNextListboxOptionValue(options, "Highest", -1)).toBe("Lowest");
  });

  it("starts from the first option when the current value is not in the list", () => {
    expect(getNextListboxOptionValue(["Story", "Bug"], "Sub-task", 1)).toBe("Bug");
    expect(getNextListboxOptionValue(["Story", "Bug"], "Sub-task", -1)).toBe("Bug");
  });

  it("returns null for empty option lists", () => {
    expect(getNextListboxOptionValue([], "Medium", 1)).toBeNull();
  });
});
