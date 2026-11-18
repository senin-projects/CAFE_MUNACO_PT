// Reuse a route implementation's existing middleware/handler chain when
// registering that implementation under its modular route file.
export function getRouteHandlerChain(router, method, path) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  if (!route) throw new Error(`Missing route handler for ${method.toUpperCase()} ${path}`);
  return route.route.stack.map((layer) => layer.handle);
}
