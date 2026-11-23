import { createRemoteJWKSet, jwtVerify } from "jose";

// BetterAuth (in the client app) gives every logged-in user a token.
// This middleware checks that token is real, using BetterAuth's
// public keys (JWKS). No token = 401, wrong role = 403.
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

const JWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

export async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized: no token" });
  }

  const token = header.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: clientUrl,
      audience: clientUrl,
    });
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized: invalid token" });
  }
}

export function verifyAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).send({ message: "Forbidden: admin only" });
  }
  next();
}
