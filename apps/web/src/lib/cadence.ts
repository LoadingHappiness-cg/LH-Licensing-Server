export function formatCadenceMonths(months: number | null | undefined) {
  if (!months || months <= 0) {
    return "Monthly";
  }

  if (months === 1) return "Monthly";
  if (months === 3) return "Quarterly";
  if (months === 12) return "Annual";
  return `Custom (${months} months)`;
}

export function cadenceSnapshotLabel(source: string | null | undefined) {
  if (source === "LICENSE") return "License override snapshot";
  return "Plan default snapshot";
}
