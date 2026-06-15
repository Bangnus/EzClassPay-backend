export function validateCreateExpense(data) {
  const errors = [];
  if (!data.title || typeof data.title !== "string") {
    errors.push("title is required and must be a string");
  }
  if (data.amount === undefined || data.amount === null || isNaN(Number(data.amount))) {
    errors.push("amount is required and must be a number");
  }
  if (!data.roomId || typeof data.roomId !== "string") {
    errors.push("roomId is required and must be a string");
  }
  if (data.receipt_url !== undefined && typeof data.receipt_url !== "string") {
    errors.push("receipt_url must be a string if provided");
  }
  return errors;
}
