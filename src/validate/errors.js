class ValidationError extends Error {
  constructor(code, message, details) {
    super(`Validation error [${code}]: ${message}`);
    this.name = "ValidationError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function failValidation(code, message, details) {
  throw new ValidationError(code, message, details);
}

module.exports = {
  ValidationError,
  failValidation,
};
