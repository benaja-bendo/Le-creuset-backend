import { suggestNextNumber } from "./sequence-number";

describe("suggestNextNumber", () => {
  const currentYear = new Date().getFullYear();

  it("should start at 0001 when nothing exists yet for the year", async () => {
    const result = await suggestNextNumber(async () => null, "CMD");
    expect(result).toBe(`CMD-${currentYear}-0001`);
  });

  it("should increment the last existing number", async () => {
    const result = await suggestNextNumber(
      async (yearPrefix) => `${yearPrefix}0007`,
      "CMD",
    );
    expect(result).toBe(`CMD-${currentYear}-0008`);
  });

  it("should pad below 4 digits", async () => {
    const result = await suggestNextNumber(
      async (yearPrefix) => `${yearPrefix}0009`,
      "FAC",
    );
    expect(result).toBe(`FAC-${currentYear}-0010`);
  });

  it("should reset to 0001 for a prefix with a compound name (FAC-GRP)", async () => {
    const result = await suggestNextNumber(async () => null, "FAC-GRP");
    expect(result).toBe(`FAC-GRP-${currentYear}-0001`);
  });

  it("should ignore an unparsable suffix rather than throw", async () => {
    const result = await suggestNextNumber(
      async (yearPrefix) => `${yearPrefix}????`,
      "CMD",
    );
    expect(result).toBe(`CMD-${currentYear}-0001`);
  });
});
