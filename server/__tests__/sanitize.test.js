import { describe, it, expect } from "vitest";
import { stripTags, sanitizeText, sanitizeCustomer } from "../utils/sanitize.js";

describe("Sanitização XSS", () => {
  it("remove tags HTML", () => {
    expect(stripTags("<script>alert('xss')</script>")).toBe("alert('xss')");
    expect(stripTags("<img src=x onerror=alert(1)>")).toBe("");
    expect(stripTags("João Silva")).toBe("João Silva");
  });

  it("sanitiza texto com limite", () => {
    expect(sanitizeText("<b>Teste</b>", 10)).toBe("Teste");
    expect(sanitizeText("A".repeat(100), 10).length).toBe(10);
    expect(sanitizeText("  João   Silva  ")).toBe("João Silva");
  });

  it("sanitiza customer", () => {
    const c = sanitizeCustomer({
      name: "<script>João</script>",
      phone: "abc (81) 99999-9999 <script>",
      addr: "Rua A <b>123</b>"
    });
    expect(c.name).toBe("João");
    expect(c.phone).toBe("(81) 99999-9999");
    expect(c.addr).toBe("Rua A 123");
  });

  it("remove caracteres de controle", () => {
    expect(sanitizeText("Teste\x00\x01\x02")).toBe("Teste");
  });
});

describe("Idempotency", () => {
  it("gera key limpa", () => {
    const clean = (k) => String(k).slice(0, 100).replace(/[^a-zA-Z0-9-_]/g, "");
    expect(clean("abc-123_def")).toBe("abc-123_def");
    expect(clean("abc<script>")).toBe("abcscript");
    expect(clean("a".repeat(200)).length).toBe(100);
  });
});
