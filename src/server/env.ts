/** Server configuration, read once and validated so a missing value fails loudly. */
const read = () => {
  const mongoUri = process.env.MONGODB_URI;
  const authSecret = process.env.AUTH_SECRET;
  if (!mongoUri) throw new Error("MONGODB_URI is not set (see .env.example)");
  if (!authSecret || authSecret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return {
    mongoUri,
    mongoDb: process.env.MONGODB_DB ?? "limonar",
    authSecret,
    sessionDays: Number(process.env.SESSION_DAYS ?? 30),
  };
};

let cached: ReturnType<typeof read> | undefined;
export const env = () => (cached ??= read());
