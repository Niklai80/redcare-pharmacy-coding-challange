import { z } from "zod";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Query-string schema for GET /repositories.
 * Zod coerces all query-string values from strings and validates them.
 */
export const searchQuerySchema = z.object({
  createdAfter: z
    .string()
    .min(1, '"createdAfter" is required (ISO 8601 date, e.g. 2020-01-01)')
    .regex(
      ISO_DATE_REGEX,
      '"createdAfter" must be a valid date in YYYY-MM-DD format'
    )
    .refine(
      (d) => !isNaN(Date.parse(d)),
      '"createdAfter" must be a valid calendar date'
    )
    .refine(
      (d) => new Date(d) <= new Date(),
      '"createdAfter" cannot be a future date'
    ),

  language: z
    .string()
    .min(1, '"language" is required (e.g. typescript, python)')
    .max(50, '"language" is too long')
    .regex(
      /^[a-zA-Z0-9#+\-.]+$/,
      '"language" contains invalid characters'
    ),

  page: z.coerce
    .number()
    .int()
    .min(1, '"page" must be ≥ 1')
    .max(1000, '"page" must be ≤ 1000')
    .default(1),

  perPage: z.coerce
    .number()
    .int()
    .min(1, '"perPage" must be ≥ 1')
    .max(100, '"perPage" must be ≤ 100 (GitHub API limit)')
    .default(30),

  sort: z
    .enum(['stars', 'forks', 'updated', 'best-match'])
    .default('stars'),
}).strict();

export type SearchQueryInput = z.input<typeof searchQuerySchema>;
export type SearchQueryParsed = z.output<typeof searchQuerySchema>;
