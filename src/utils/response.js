export function success(res, data = null, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function error(res, message = "Internal Server Error", statusCode = 500, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}
