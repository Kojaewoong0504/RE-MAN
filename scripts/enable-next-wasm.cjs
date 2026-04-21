try {
  if (!process.versions.webcontainer) {
    Object.defineProperty(process.versions, "webcontainer", {
      configurable: true,
      value: "1"
    });
  }
} catch {
  // Best-effort local runtime workaround for native SWC load failures.
}
