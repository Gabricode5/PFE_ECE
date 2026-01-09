import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const authToken = request.cookies.get('auth_token')?.value

    // Define public paths that don't satisfy the protection check
    const isPublicPath =
        request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/sign-up' ||
        request.nextUrl.pathname === '/forgot-password' ||
        request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname === '/favicon.ico' ||
        request.nextUrl.pathname.startsWith('/static')

    if (!isPublicPath && !authToken) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (authToken && request.nextUrl.pathname === '/login') {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
