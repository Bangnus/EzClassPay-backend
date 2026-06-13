import { error } from "../utils/response.js";
import { STATUS_CODE } from "../constants/statusCode.js";

export function validate(schema) {
  return (req, _res, next) => {
    const { error: validationError } = schema.validate(req.body, { abortEarly: false });

    if (validationError) {
      const messages = validationError.details.map((d) => d.message);
      return error(_res, "Validation failed", STATUS_CODE.UNPROCESSABLE, messages);
    }

    next();
  };
}
