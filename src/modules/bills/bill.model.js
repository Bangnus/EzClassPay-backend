export const billSelect = {
  id: true,
  month: true,
  year: true,
  dueDate: true,
  amount: true,
  status: true,
  roomId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  room: {
    select: {
      name: true,
      promptpayNo: true,
    },
  },
  user: {
    select: {
      lineUid: true,
      displayName: true,
    },
  },
};
