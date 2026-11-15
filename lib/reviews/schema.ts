import { z } from "zod";

/** Shared storefront + admin validation for buyer review submissions. */
export const productReviewSubmitSchema = z.object({
  productSlug: z.string().trim().min(1).max(200),
  rating: z.coerce
    .number()
    .int()
    .min(1, "Choose a rating from 1 to 5.")
    .max(5, "Choose a rating from 1 to 5."),
  title: z
    .string()
    .trim()
    .max(120, "Keep the title under 120 characters.")
    .default(""),
  body: z
    .string()
    .trim()
    .max(2_000, "Keep the review under 2,000 characters.")
    .refine(
      (value) => value.length === 0 || value.length >= 10,
      "Write at least 10 characters, or leave this blank.",
    )
    .default(""),
  locale: z.enum(["en", "pt", "ru"]).default("en"),
  authorName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(80, "Keep the name under 80 characters."),
  authorEmail: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(200, "Keep the email under 200 characters."),
  /** Honeypot — must stay empty. */
  company: z.string().max(200).optional().default(""),
});

export type ProductReviewSubmitInput = z.infer<typeof productReviewSubmitSchema>;

export const productReviewStatusSchema = z.enum(["PENDING", "PUBLISHED", "HIDDEN"]);

export type ProductReviewStatusValue = z.infer<typeof productReviewStatusSchema>;
