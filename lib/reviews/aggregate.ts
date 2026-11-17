export type ReviewRatingRow = {
  rating: number;
  status: "PENDING" | "PUBLISHED" | "HIDDEN";
};

/**
 * Aggregate from PUBLISHED rows only. PENDING / HIDDEN never affect average or count.
 */
export function aggregatePublishedReviews(rows: ReviewRatingRow[]): {
  average: number | null;
  count: number;
} {
  const published = rows.filter((row) => row.status === "PUBLISHED");
  if (published.length === 0) return { average: null, count: 0 };
  const sum = published.reduce((acc, row) => acc + row.rating, 0);
  const average = Math.round((sum / published.length) * 10) / 10;
  return { average, count: published.length };
}
