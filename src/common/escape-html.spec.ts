import { escapeHtml } from "./escape-html";

describe("escapeHtml", () => {
  it("should neutralise tags and attributes", () => {
    expect(escapeHtml(`<a href="https://x.io" title='y'>clic</a>`)).toBe(
      "&lt;a href=&quot;https://x.io&quot; title=&#39;y&#39;&gt;clic&lt;/a&gt;",
    );
  });

  it("should escape ampersands first so entities are not double-decoded", () => {
    expect(escapeHtml("&lt;b&gt;")).toBe("&amp;lt;b&amp;gt;");
  });

  it("should leave plain text untouched", () => {
    expect(escapeHtml("Bague en or 18 carats — 12,5 g")).toBe(
      "Bague en or 18 carats — 12,5 g",
    );
  });
});
