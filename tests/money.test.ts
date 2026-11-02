import { describe, expect, it } from "vitest";
import { convert, formatMoney, parseAmount, toInputValue } from "@/lib/money";

describe("parseAmount", () => {
  it.each([
    ["12,50", 1250],
    ["12.5", 1250],
    ["12", 1200],
    ["1 234,56", 123456],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1.234", 123400],
    ["0,99 zł", 99],
    ["-3", -300],
  ])("%s -> %i", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2345", "12,5,0x", null, undefined, {}])("rejects %s", (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it("accepts numbers and avoids float drift", () => {
    expect(parseAmount(0.1 + 0.2)).toBe(30);
  });
});

describe("formatting", () => {
  it("formats Polish złoty (Polish style groups from five digits)", () => {
    expect(formatMoney(1234567).replace(/\s/g, " ")).toBe("12 345,67 zł");
    expect(formatMoney(123456).replace(/\s/g, " ")).toBe("1234,56 zł");
  });

  it("round-trips through the input format", () => {
    expect(toInputValue(1250)).toBe("12,50");
    expect(parseAmount(toInputValue(98765))).toBe(98765);
  });

  it("converts with a PLN rate and rounds to grosze", () => {
    expect(convert(1000, 4.3125)).toBe(4313);
  });
});
