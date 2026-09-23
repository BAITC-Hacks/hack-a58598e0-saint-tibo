export type Platform = "teams" | "google_meet" | "zoom";

export type MeetingTarget = Readonly<{ platform: Platform; join_url: string }>;

/** Private join input, never include it in status, logs, or error messages. No I/O. */
export function parseMeetingUrl(input: string): MeetingTarget {
  const invalid = () => new Error("invalid_meeting_url");
  if (typeof input !== "string" || input.length > 4096 || /[\s\\#\x00-\x1f\x7f]/.test(input)) {
    throw invalid();
  }
  // Check raw syntax too: URL() otherwise silently removes dot segments or normalizes ports.
  if (!/^https:\/\/[a-z0-9.-]+\//i.test(input) || /\/(?:\.|%2e){1,2}(?:\/|\?|$)/i.test(input)) {
    throw invalid();
  }
  let url: URL;
  try { url = new URL(input); } catch { throw invalid(); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) throw invalid();
  const query = (allowed: string[]) => {
    for (const key of url.searchParams.keys()) {
      if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw invalid();
    }
  };
  let platform: Platform;
  if (url.hostname === "meet.google.com" && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(url.pathname)) {
    platform = "google_meet";
    query(["authuser", "hs"]);
    url.pathname = url.pathname.toLowerCase().replace(/\/$/, "");
    url.search = "";
  } else if ((url.hostname === "zoom.us" || /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.zoom\.us$/.test(url.hostname))
      && /^\/j\/[0-9]{9,11}\/?$/.test(url.pathname)) {
    platform = "zoom";
    query(["pwd"]);
    if (url.searchParams.has("pwd") && !/^[a-zA-Z0-9._~-]{1,256}$/.test(url.searchParams.get("pwd")!)) throw invalid();
    url.pathname = url.pathname.replace(/\/$/, "");
  } else if (["teams.microsoft.com", "teams.live.com"].includes(url.hostname)
      && /^\/meet\/[0-9]{9,20}\/?$/.test(url.pathname)) {
    platform = "teams";
    query(["p"]);
    if (url.searchParams.has("p") && !/^[a-zA-Z0-9._~-]{1,256}$/.test(url.searchParams.get("p")!)) throw invalid();
    url.pathname = url.pathname.replace(/\/$/, "");
  } else if (url.hostname === "teams.microsoft.com"
      && /^\/l\/meetup-join\/19(?:%3a|:)meeting_[a-zA-Z0-9_-]+(?:%40|@)thread\.v2\/0$/i.test(url.pathname)) {
    platform = "teams";
    query(["context"]);
    if (url.searchParams.has("context")) {
      let context: unknown;
      try { context = JSON.parse(url.searchParams.get("context")!); } catch { throw invalid(); }
      const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
      if (!context || typeof context !== "object" || Array.isArray(context)
          || Object.entries(context).some(([key, value]) => !["Tid", "Oid"].includes(key) || typeof value !== "string" || !uuid.test(value))) throw invalid();
      url.search = "";
      url.searchParams.set("context", JSON.stringify(context));
    }
  } else {
    // Deliberately no short links, arbitrary tenant domains, personal rooms or redirect resolution.
    throw invalid();
  }
  return Object.freeze({ platform, join_url: url.href });
}
