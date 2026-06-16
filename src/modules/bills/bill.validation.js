export function validateGenerateBills(data) {
  const errors = [];
  if (!data.month || typeof data.month !== "number" || data.month < 1 || data.month > 12) {
    errors.push("month is required and must be a number between 1 and 12");
  }
  if (!data.year || typeof data.year !== "number") {
    errors.push("year is required and must be a number");
  }
  return errors;
}

export function validateUpdateBillStatus(data) {
  const errors = [];
  if (!data.status || !["UNPAID", "PAID", "OVERDUE", "CANCELLED"].includes(data.status)) {
    errors.push("status must be one of: UNPAID, PAID, OVERDUE, CANCELLED");
  }
  return errors;
}
