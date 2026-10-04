const moneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function toPaise(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * @param {{ mrp?: number|string, sellingPrice?: number|string, price?: number|string, originalPrice?: number|string, discount_percent?: number }} product
 */
export function getProductPricing(product) {
  const sellingRaw = product?.sellingPrice ?? product?.price ?? product?.selling_price;
  const mrpRaw = product?.mrp ?? product?.originalPrice ?? product?.original_price;

  const sellingPaise = toPaise(sellingRaw);
  const mrpPaise = toPaise(mrpRaw);

  if (sellingPaise == null || sellingPaise < 0) {
    return { hasSavings: false, sellingPrice: sellingRaw, mrp: null };
  }

  if (mrpPaise == null || mrpPaise <= 0 || mrpPaise <= sellingPaise) {
    return {
      hasSavings: false,
      sellingPrice: sellingPaise / 100,
      mrp: mrpPaise != null ? mrpPaise / 100 : null,
      formattedSelling: moneyFormatter.format(sellingPaise / 100),
    };
  }

  const savingsPaise = mrpPaise - sellingPaise;
  const percent = Math.round((savingsPaise / mrpPaise) * 100);
  const serverPercent = product?.discount_percent != null ? Number(product.discount_percent) : null;
  const discountPercent =
    serverPercent != null && !Number.isNaN(serverPercent) && Math.abs(serverPercent - percent) <= 1
      ? serverPercent
      : percent;

  return {
    hasSavings: savingsPaise > 0 && discountPercent > 0,
    sellingPrice: sellingPaise / 100,
    mrp: mrpPaise / 100,
    savingsAmount: savingsPaise / 100,
    discountPercent,
    formattedSelling: moneyFormatter.format(sellingPaise / 100),
    formattedMrp: moneyFormatter.format(mrpPaise / 100),
    formattedSavings: moneyFormatter.format(savingsPaise / 100),
    savingsLabel: `You save ${moneyFormatter.format(savingsPaise / 100)} (${discountPercent}% off)`,
    ariaLabel: `Save ${Math.round(savingsPaise / 100)} rupees, ${discountPercent} percent off`,
    ribbonLabel: `${discountPercent}% OFF`,
  };
}

export function sumOrderSavings(lineItems) {
  let totalPaise = 0;
  for (const line of lineItems || []) {
    const pricing = getProductPricing({
      mrp: line.mrp ?? line.original_price ?? line.originalPrice,
      sellingPrice: line.unit_price ?? line.unitPrice ?? line.price ?? line.selling_price,
      quantity: line.quantity,
    });
    if (pricing.hasSavings) {
      const qty = Math.max(1, Number(line.quantity) || 1);
      totalPaise += Math.round(pricing.savingsAmount * 100) * qty;
    }
  }
  return {
    totalSavings: totalPaise / 100,
    formattedTotalSavings: moneyFormatter.format(totalPaise / 100),
    hasSavings: totalPaise > 0,
  };
}

export { moneyFormatter };
