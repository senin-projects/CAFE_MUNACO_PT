export function notFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

export function errorHandler(err, req, res, next) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Check the server terminal for details.' });
}
