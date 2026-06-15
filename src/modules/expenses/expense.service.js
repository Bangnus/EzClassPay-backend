import * as expenseRepo from "./expense.repository.js";

export async function createExpense(data) {
  const expense = await expenseRepo.create({
    title: data.title,
    amount: parseFloat(data.amount),
    receiptUrl: data.receipt_url || null,
    roomId: data.roomId,
  });
  return expense;
}

export async function getExpenseById(id) {
  const expense = await expenseRepo.findById(id);
  if (!expense) {
    const error = new Error("Expense not found");
    error.statusCode = 404;
    throw error;
  }
  return expense;
}

export async function getExpensesByRoomId(roomId) {
  return expenseRepo.findByRoomId(roomId);
}
