import PocketBase from "pocketbase";

function resolvePbUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_PB_URL;
  if (envUrl && envUrl.trim()) return envUrl;

  // If the app is opened from another device (e.g. http://192.168.x.x:3000),
  // hardcoding 127.0.0.1 would point to the *client* device, not the server.
  // Default to the current hostname in the browser.
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8090`;
  }

  return "http://127.0.0.1:8090";
}

export const PB_URL = resolvePbUrl();

export const pb = new PocketBase(PB_URL);


