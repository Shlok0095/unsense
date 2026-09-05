export const timeTool = {
  name: "time",
  description: "Returns the current date/time, optionally in a specific IANA timezone.",
  schema: { timezone: "optional IANA timezone string, e.g. 'America/New_York'" },
  permissions: [],
  timeoutMs: 500,
  async handler({ timezone } = {}) {
    const now = new Date();
    try {
      const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone || "UTC",
        dateStyle: "full",
        timeStyle: "long",
      }).format(now);
      return { iso: now.toISOString(), timezone: timezone || "UTC", formatted };
    } catch {
      return { iso: now.toISOString(), timezone: "UTC", formatted: now.toUTCString() };
    }
  },
};
