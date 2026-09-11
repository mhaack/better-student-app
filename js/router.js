// Minimal hash router — no framework, matches the rest of this project.
const routes = [];

/**
 * @param {RegExp} pattern must have named capture groups for params
 * @param {(params: Record<string,string>) => void | Promise<void>} handler
 */
export function route(pattern, handler) {
  routes.push({ pattern, handler });
}

export function navigate(path) {
  if (location.hash === `#${path}`) {
    dispatch();
  } else {
    location.hash = path;
  }
}

function currentPath() {
  return location.hash.slice(1) || "/heute";
}

async function dispatch() {
  const path = currentPath();
  for (const { pattern, handler } of routes) {
    const match = path.match(pattern);
    if (match) {
      await handler(match.groups ?? {});
      return;
    }
  }
  navigate("/heute");
}

export function startRouter() {
  window.addEventListener("hashchange", dispatch);
  dispatch();
}

export function currentBasePath() {
  return "/" + currentPath().split("/")[1];
}
