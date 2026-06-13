export const roomSelect = {
  id: true,
  managerId: true,
  name: true,
  collectionType: true,
  totalTargetAmount: true,
  periodicAmount: true,
  promptpayNo: true,
  isPremium: true,
  lineGroupId: true,
  createdAt: true,
  members: {
    select: {
      userId: true,
      joinedAt: true,
      user: {
        select: {
          displayName: true,
          pictureUrl: true
        }
      }
    }
  },
  manager: {
    select: {
      displayName: true,
      pictureUrl: true,
      lineUid: true
    }
  }
};
