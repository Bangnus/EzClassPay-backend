export function validateCreateRoom(data) {
  const errors = [];
  if (!data.name || typeof data.name !== "string") {
    errors.push("Room name is required and must be a string");
  }
  if (!data.collection_type || !["TARGET", "MONTHLY"].includes(data.collection_type)) {
    errors.push("Collection type is required and must be either 'TARGET' or 'MONTHLY'");
  }
  if (!data.promptpay_no || typeof data.promptpay_no !== "string") {
    errors.push("Promptpay number is required and must be a string");
  }
  if (!data.line_uid || typeof data.line_uid !== "string") {
    errors.push("line_uid is required");
  }
  if (data.line_group_id && typeof data.line_group_id !== "string") {
    errors.push("line_group_id must be a string if provided");
  }
  return errors;
}

export function validateUpdateRoom(data) {
  const errors = [];
  if (data.name && typeof data.name !== "string") {
    errors.push("Room name must be a string");
  }
  if (data.collectionType && !["TARGET", "MONTHLY"].includes(data.collectionType)) {
    errors.push("Collection type must be either 'TARGET' or 'MONTHLY'");
  }
  if (data.promptpayNo && typeof data.promptpayNo !== "string") {
    errors.push("Promptpay number must be a string");
  }
  return errors;
}
