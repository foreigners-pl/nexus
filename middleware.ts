import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedPaths = ['/home', '/clients', '/cases', '/board', '/wiki', '/chat', '/settings', '/leads', '/mobile', '/requests', '/actions', '/notifications', '/search']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Server actions (POST), RSC payloads, and prefetches skip auth entirely:
  // - server actions enforce auth themselves via RLS + their own client
  // - RSC payloads for client-side navigations carry component trees, not
  //   sensitive data; protection still applies to real document loads
  // - prefetches carry no sensitive payload; the real navigation re-checks
  // This avoids a Supabase auth network roundtrip per request, which was
  // serializing page loads and flooding slow connections during prefetch bursts.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return NextResponse.next({ request })
  }
  if (
    request.headers.get('next-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('rsc') ||
    request.headers.get('next-router-state-tree')
  ) {
    return NextResponse.next({ request })
  }

  // Auth decision only needed for protected routes, /login and /
  const isProtectedPath = protectedPaths.some(p => path.startsWith(p))
  if (!isProtectedPath && path !== '/login' && path !== '/') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to home if accessing login while authenticated
  if (request.nextUrl.pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Redirect root to login or home based on auth status
  if (request.nextUrl.pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/home', request.url))
    } else {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
