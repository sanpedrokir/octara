import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

function getSecret() {
  const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production-32ch';
  return new TextEncoder().encode(secret);
}

const protectedRoutes = ['/dashboard', '/profile', '/career', '/my-courses'];
const adminRoutes = ['/admin'];
const authRoutes = ['/login', '/register'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('session')?.value;

  const isProtected = protectedRoutes.some(r => pathname.startsWith(r));
  const isAdmin = adminRoutes.some(r => pathname.startsWith(r));
  const isAuthRoute = authRoutes.some(r => pathname.startsWith(r));

  if (!isProtected && !isAdmin) {
    if (isAuthRoute && token) {
      try {
        await jwtVerify(token, getSecret());
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } catch {
        // invalid token, let them through
      }
    }
    return NextResponse.next();
  }

  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (isAdmin && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', String(payload.userId));
    response.headers.set('x-user-email', String(payload.email));
    response.headers.set('x-user-role', String(payload.role));
    return response;
  } catch {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/career/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
