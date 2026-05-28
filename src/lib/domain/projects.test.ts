import { describe, expect, it } from "vitest";
import { orderProjectNames } from "./projects";

describe("project display helpers", () => {
  it("pins exactly Transversal first and keeps the remaining project order", () => {
    expect(orderProjectNames(["STT", "PilotLab", "Transversal", "MR Studio"])).toEqual([
      "Transversal",
      "STT",
      "PilotLab",
      "MR Studio"
    ]);
  });

  it("does not reorder when the exact Transversal project is absent", () => {
    expect(orderProjectNames(["STT", "transversal", "MR Studio"])).toEqual([
      "STT",
      "transversal",
      "MR Studio"
    ]);
  });
});
