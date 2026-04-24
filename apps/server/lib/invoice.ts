function currentIndianFyRange(): { startYear: number; endYear: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");

  const startYear = month >= 4 ? year : year - 1;
  return { startYear, endYear: startYear + 1 };
}

export function generateInvoiceNumber(lastNumber: number): string {
  const { startYear, endYear } = currentIndianFyRange();
  const yyStart = String(startYear % 100).padStart(2, "0");
  const yyEnd = String(endYear % 100).padStart(2, "0");
  const sequence = String(lastNumber + 1).padStart(4, "0");
  return `CRX/${yyStart}-${yyEnd}/${sequence}`;
}

export function calculateGst(amountPaise: number, hasGstin: boolean): number {
  if (!hasGstin) return 0;
  return Math.floor((amountPaise * 18 + 50) / 100);
}
