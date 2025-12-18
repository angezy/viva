"use server";

import jwt from "jsonwebtoken";

export const COOKIE_NAME = "viva_token";
const JWT_SECRET = process.env.JWT_SECRET;

// Lightweight token verifier for server components (dashboard layout)
export function verifyToken(token) {
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    return null;
  }
}
