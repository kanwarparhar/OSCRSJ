// ============================================================
// JWT dispute tokens
// ============================================================
// Signed tokens embedded in the "I did not agree" link of co-author
// notification emails. Each token is bound to a single (manuscriptId,
// coAuthorEmail) pair and expires 30 days after issue.
//
// Uses `jose` because it is edge-runtime friendly and is the same
// library Next.js itself uses internally for middleware auth.
// ============================================================

import { SignJWT, jwtVerify } from 'jose'

const TOKEN_EXPIRATION = '30d'
const TOKEN_ISSUER = 'oscrsj'
const TOKEN_AUDIENCE = 'co-author-dispute'

function getSecret(): Uint8Array {
  const secret = process.env.DISPUTE_TOKEN_SECRET
  if (!secret) {
    throw new Error('DISPUTE_TOKEN_SECRET is not set')
  }
  return new TextEncoder().encode(secret)
}

export interface DisputeTokenPayload {
  manuscriptId: string
  email: string
}

export async function generateDisputeToken(
  manuscriptId: string,
  coAuthorEmail: string
): Promise<string> {
  return await new SignJWT({
    manuscriptId,
    email: coAuthorEmail.toLowerCase(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(getSecret())
}

export async function verifyDisputeToken(
  token: string
): Promise<DisputeTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    })
    const manuscriptId =
      typeof payload.manuscriptId === 'string' ? payload.manuscriptId : null
    const email = typeof payload.email === 'string' ? payload.email : null
    if (!manuscriptId || !email) return null
    return { manuscriptId, email }
  } catch {
    return null
  }
}

/**
 * Build the full URL a co-author clicks from their notification email.
 */
export function buildDisputeUrl(
  manuscriptId: string,
  token: string,
  siteUrl: string
): string {
  const base = siteUrl.replace(/\/$/, '')
  return `${base}/api/submissions/${manuscriptId}/co-author-dispute?token=${encodeURIComponent(token)}`
}
