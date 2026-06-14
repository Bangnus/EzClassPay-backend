export function validateSync(body) {
  const errors = [];
  if (!body.line_uid) errors.push("line_uid is required");
  if (!body.name) errors.push("name is required");
  if (!body.action) errors.push("action is required");
  return errors;
}
