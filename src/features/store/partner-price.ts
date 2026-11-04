/** Pure rule (unit-tested): the price a viewer pays. Partner prices apply only below the normal price. */
export function effectiveUnitPrice(price: bigint, partnerPrice: bigint | null, partnerPricesAllowed: boolean): bigint {
  return partnerPricesAllowed && partnerPrice !== null && partnerPrice > BigInt(0) && partnerPrice < price ? partnerPrice : price;
}
