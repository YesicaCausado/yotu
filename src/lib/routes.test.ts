import { describe, expect, it } from "vitest";
import { matchesPrefix, safeNextPath } from "./routes";

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/pareja")).toBe("/pareja");
    expect(safeNextPath("/invitacion/abc?x=1")).toBe("/invitacion/abc?x=1");
  });

  it("rechaza redirecciones abiertas y valores raros", () => {
    for (const value of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "/ok\n", "", null, 42]) {
      expect(safeNextPath(value)).toBe("/inicio");
    }
  });
});

describe("matchesPrefix", () => {
  it("coincide por segmento completo", () => {
    expect(matchesPrefix("/pareja", ["/pareja"])).toBe(true);
    expect(matchesPrefix("/pareja/x", ["/pareja"])).toBe(true);
    expect(matchesPrefix("/parejas", ["/pareja"])).toBe(false);
  });
});
