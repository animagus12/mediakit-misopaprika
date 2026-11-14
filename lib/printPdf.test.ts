import { describe, expect, it } from "vitest";
import { pdfFilename } from "./printPdf";

describe("pdfFilename", () => {
  it("keeps a name that is already safe", () => {
    expect(pdfFilename("MSP-INV-0014")).toBe("MSP-INV-0014.pdf");
  });

  it("turns each run of unsafe characters into one dash", () => {
    expect(pdfFilename('12/"A" b')).toBe("12-A-b.pdf");
  });

  it("leaves no dash at either end", () => {
    expect(pdfFilename("@misopaprika media kit!")).toBe("misopaprika-media-kit.pdf");
  });

  it("falls back to a generic name when nothing safe is left", () => {
    expect(pdfFilename("")).toBe("document.pdf");
    expect(pdfFilename("@@ //")).toBe("document.pdf");
  });
});
