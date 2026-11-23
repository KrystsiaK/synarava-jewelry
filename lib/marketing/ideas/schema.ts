export const MARKETING_IDEAS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "locale",
          "productIds",
          "signalIds",
          "hook",
          "script",
          "shotList",
          "caption",
          "weekSlot",
        ],
        properties: {
          locale: { type: "string", enum: ["en", "pt"] },
          productIds: { type: "array", items: { type: "string" } },
          signalIds: { type: "array", items: { type: "string" } },
          hook: { type: "string" },
          script: { type: "string" },
          shotList: { type: "array", items: { type: "string" } },
          caption: { type: "string" },
          weekSlot: { type: "integer", minimum: 1, maximum: 4 },
        },
      },
    },
  },
} as const;

export type RawMarketingIdea = {
  locale: string;
  productIds: string[];
  signalIds: string[];
  hook: string;
  script: string;
  shotList: string[];
  caption: string;
  weekSlot: number;
};
