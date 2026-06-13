export function validateLineLogin(body) {
  const errors = [];
  if (!body.lineUid) errors.push("lineUid is required");
  if (!body.displayName) errors.push("displayName is required");
  return errors;
}
