/**
 * Format numbers with commas.
 *
 * Example:
 * 8520      -> 8,520
 * 1234567   -> 1,234,567
 * 100       -> 100
 */
export const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return "0";

  return new Intl.NumberFormat("en-IN").format(Number(value));
};