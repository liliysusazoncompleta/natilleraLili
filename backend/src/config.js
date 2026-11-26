const DEVELOPMENT_JWT_SECRET = "development-secret-change-me";

export function createAppConfig(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const jwtSecret = env.JWT_SECRET || (isProduction ? "" : DEVELOPMENT_JWT_SECRET);
  const configuredCorsOrigins = (env.CORS_ORIGIN || (isProduction ? "" : "http://localhost:5173"))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOrigins = isProduction
    ? [...new Set([...configuredCorsOrigins, "https://liliysusazoncompleta.github.io"])]
    : configuredCorsOrigins;
  const port = Number(env.PORT || 4000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT debe ser un entero entre 1 y 65535");
  }
  if (isProduction && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción");
  }
  if (isProduction && !env.DATABASE_URL) {
    throw new Error("DATABASE_URL es obligatorio en producción");
  }
  if (isProduction && configuredCorsOrigins.length === 0) {
    throw new Error("CORS_ORIGIN debe definir al menos un origen permitido en producción");
  }

  return { port, jwtSecret, corsOrigins };
}
