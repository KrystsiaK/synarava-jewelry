import { z } from "zod";

import { parseFormData } from "../parse-form-data";

const schema = z.object({
  name: z.string().trim().min(1),
  note: z.string().trim().default(""),
});

function formData(fields: Record<string, string | File>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("parseFormData", () => {
  it("parses valid fields through the schema", () => {
    const result = parseFormData(formData({ name: " Oak Bracelet " }), schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Oak Bracelet", note: "" });
    }
  });

  it("fails when a required field is missing", () => {
    const result = parseFormData(formData({ note: "hello" }), schema);
    expect(result.success).toBe(false);
  });

  it("fails when a required field is only whitespace", () => {
    const result = parseFormData(formData({ name: "   " }), schema);
    expect(result.success).toBe(false);
  });

  it("treats a File value as an empty string rather than throwing", () => {
    const file = new File(["contents"], "photo.png", { type: "image/png" });
    const result = parseFormData(formData({ name: "Oak Bracelet", note: file }), schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("");
    }
  });
});
