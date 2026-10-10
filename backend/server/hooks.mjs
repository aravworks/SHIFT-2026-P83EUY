export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("npm:")) {
    // strip the "npm:" prefix and a trailing "@version"
    return nextResolve(specifier.slice(4).replace(/@[^/@]+$/, ""), context);
  }
  return nextResolve(specifier, context);
}
