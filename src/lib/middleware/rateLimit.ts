import { NextRequest, NextResponse } from 'next/server';

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  req: NextRequest,
  role: 'admin' | 'agent' | 'unknown' = 'unknown'
) {
  if (role === 'admin') return null;

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const key = `${ip}:${role}`;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = role === 'agent' ? 50 : 100;

  // Inline cleanup using Array.from to avoid iterator downlevel issues
  if (rateLimitStore.size > 500) {
    Array.from(rateLimitStore.keys()).forEach(k => {
      const v = rateLimitStore.get(k)!;
      if (now > v.resetTime) rateLimitStore.delete(k);
    });
  }

  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }

  if (existing.count >= maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((existing.resetTime - now) / 1000)),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  existing.count++;
  return null;
}
