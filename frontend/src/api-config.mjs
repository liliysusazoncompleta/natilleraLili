export function resolveApiConfig(apiUrl, isProduction) {
  const value = apiUrl?.trim();
  if (!isProduction) return { url: value || "http://localhost:4000/api", error: "" };

  if (!value) {
    return { url: "", error: "La URL del backend no está configurada. Contacta al administrador." };
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && url.pathname.replace(/\/+$/, "").endsWith("/api") && !url.search && !url.hash) {
      return { url: value.replace(/\/+$/, ""), error: "" };
    }
  } catch {
    // Report the same configuration error without exposing the supplied value.
  }
  return { url: "", error: "La URL del backend no es válida. Contacta al administrador." };
}
