/**
 * Validates parts of the request with Zod schemas, e.g.
 *   router.post('/', validate({ body: createSchema }), controller)
 *
 * On success the parsed (trimmed, defaulted, unknown-keys-stripped) values are stored on
 * `req.validated.body | params | query`; controllers should read from there, not from req.body.
 * (In Express 5, req.query is read-only, so a separate object keeps all three consistent.)
 * On failure the ZodError is thrown and the central error handler turns it into a 400.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.validated = {};
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) {
        req.validated[part] = schemas[part].parse(req[part] ?? {});
      }
    }
    next();
  };
}
