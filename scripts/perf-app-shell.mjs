#!/usr/bin/env node

import process from "node:process";
import { performance } from "node:perf_hooks";

const baseUrl = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3001";
const thresholdMs = Number(process.env.PERF_THRESHOLD_MS ?? "500");
const includeAuth = process.env.PERF_INCLUDE_AUTH !== "false";

function assertOk(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getSetCookieArray(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function mergeCookieHeader(previous, response) {
  const nextCookies = getSetCookieArray(response)
    .map((value) => value.split(";")[0])
    .filter(Boolean);

  if (nextCookies.length === 0) {
    return previous;
  }

  const cookieMap = new Map();

  for (const part of previous.split(/;\s*/).filter(Boolean)) {
    const [name, ...rest] = part.split("=");
    cookieMap.set(name, `${name}=${rest.join("=")}`);
  }

  for (const part of nextCookies) {
    const [name] = part.split("=");
    cookieMap.set(name, part);
  }

  return Array.from(cookieMap.values()).join("; ");
}

async function measureRoute(pathname, cookieHeader = "") {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    redirect: "manual"
  });
  const html = await response.text();
  const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

  return {
    pathname,
    status: response.status,
    durationMs,
    htmlLength: html.length,
    cookieHeader: mergeCookieHeader(cookieHeader, response)
  };
}

async function warmRoute(pathname, cookieHeader = "") {
  await fetch(`${baseUrl}${pathname}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    redirect: "manual"
  }).catch(() => null);
}

async function loginForPerf() {
  const response = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: "POST",
    redirect: "manual"
  });

  if (!response.ok) {
    return "";
  }

  return mergeCookieHeader("", response);
}

async function main() {
  const measurements = [];
  const publicRoutes = ["/", "/programs/style", "/login"];

  for (const pathname of publicRoutes) {
    await warmRoute(pathname);
  }

  for (const pathname of publicRoutes) {
    measurements.push(await measureRoute(pathname));
  }

  let cookieHeader = "";

  if (includeAuth) {
    cookieHeader = await loginForPerf();

    if (cookieHeader) {
      const protectedRoutes = ["/closet", "/history", "/profile"];

      for (const pathname of protectedRoutes) {
        await warmRoute(pathname, cookieHeader);
      }

      for (const pathname of protectedRoutes) {
        measurements.push(await measureRoute(pathname, cookieHeader));
      }
    }
  }

  for (const item of measurements) {
    console.log(
      JSON.stringify(
        {
          route: item.pathname,
          status: item.status,
          duration_ms: item.durationMs,
          html_length: item.htmlLength
        },
        null,
        2
      )
    );
  }

  const failed = measurements.filter(
    (item) => item.status >= 400 || item.durationMs > thresholdMs || item.htmlLength === 0
  );

  assertOk(
    failed.length === 0,
    `perf_budget_failed:${failed
      .map((item) => `${item.pathname}:${item.status}:${item.durationMs}ms`)
      .join(",")}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
