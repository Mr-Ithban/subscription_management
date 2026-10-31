export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const target = source === 'params' ? req.params : source === 'query' ? req.query : req.body;
    const result = schema.safeParse(target);
    if (!result.success) {
      const message = [...new Set(result.error.issues.map((issue) => issue.message))].join('; ');
      return res.status(400).json({ error: { message } });
    }
    if (source === 'params') req.params = result.data;
    else if (source === 'query') req.query = result.data;
    else req.body = result.data;
    return next();
  };
}
