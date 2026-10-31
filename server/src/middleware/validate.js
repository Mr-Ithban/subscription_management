const requestSources = new Set(['body', 'query', 'params']);

export function validate(schema, source = 'body') {
  if (!requestSources.has(source)) {
    throw new TypeError("validate source must be 'body', 'query', or 'params'");
  }

  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      const message = [...new Set(result.error.issues.map((issue) => issue.message))].join('; ');

      return res.status(400).json({
        error: { message, details },
      });
    }

    Object.defineProperty(req, source, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: result.data,
    });
    return next();
  };
}
