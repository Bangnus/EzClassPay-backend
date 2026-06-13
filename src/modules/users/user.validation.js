export function validateUpdateProfile(body) {
  const errors = [];
  if (body.displayName !== undefined && typeof body.displayName !== "string") errors.push("displayName must be a string");
  if (body.email !== undefined && typeof body.email !== "string") errors.push("email must be a string");
  if (body.role !== undefined && !["MANAGER", "MEMBER"].includes(body.role)) errors.push("role must be MANAGER or MEMBER");
  return errors;
}
