import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let configured = false;
let loadingPromise: Promise<void> | null = null;

/**
 * Ensures the Maps JS API is configured once, and lazily loads the requested libraries.
 * Uses the recommended setOptions + importLibrary approach.
 */
export async function loadGoogleMaps(libraries: Array<"maps" | "places" | "marker">) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");

  if (!configured) {
    setOptions({ key, v: "weekly" });
    configured = true;
  }

  // Prevent duplicate concurrent loads
  if (!loadingPromise) {
    loadingPromise = (async () => {
      // no-op: importLibrary does the real work below
    })();
  }
  await loadingPromise;

  // Load requested libraries
  for (const lib of libraries) {
    await importLibrary(lib);
  }
}
