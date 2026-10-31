/**
 * Zod validation middleware.
 * Formats errors into { error: { message } } standard contract.
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const target = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
    const result = schema.safeParse(target);

    if (!result.success) {
      const message = [...new Set(result.error.issues.map((issue) => issue.message))].join('; ');
      return res.status(400).json({ error: { message } });
    }

    if (source === 'query') {
      req.query = result.data;
    } else if (source === 'params') {
      req.params = result.data;
    } else {
      req.body = result.data;
    }

    next();
  };
}
