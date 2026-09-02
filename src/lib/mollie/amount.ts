/** Mirrors the (non-exported) `Amount` shape from `@mollie/api-client`. */
export interface MollieAmount {
  currency: string;
  value: string;
}

/**
 * Mollie amounts are strings with exactly two decimals, e.g. "10.00" —
 * everywhere else in this app amounts are stored as integer cents to
 * avoid floating point rounding issues.
 */
export function toMollieAmount(
  amountCents: number,
  currency: string
): MollieAmount {
  return {
    currency,
    value: (amountCents / 100).toFixed(2),
  };
}
