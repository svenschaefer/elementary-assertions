class ValidationError extends Error {
  constructor(code, message) {
    super(`Validation error [${code}]: ${message}`);
    this.name = "ValidationError";
    this.code = code;
  }
}

function failValidation(code, message) {
  throw new ValidationError(code, message);
}

module.exports = {
  ValidationError,
  failValidation,
};
