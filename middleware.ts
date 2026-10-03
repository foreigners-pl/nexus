import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  // All dashboard routes are protected
  const protectedPaths = ['/home', '/clients', '/cases', '/board', '/wiki', '/chat', '/settings', '/leads', '/mobile']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Phones get the mobile home, everything else gets the dashboard
  const ua = request.headers.get('user-agent') || ''
  const isMobileUA = /mobile|android|iphone|ipod|iemobile|opera mini|blackberry/i.test(ua)
  const home = isMobileUA ? '/mobile' : '/home'

  // Desktop browser hitting the mobile app -> dashboard
  if (!isMobileUA && request.nextUrl.pathname.startsWith('/mobile')) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Phone hitting the desktop home -> mobile home
  if (isMobileUA && request.nextUrl.pathname === '/home') {
    return NextResponse.redirect(new URL('/mobile', request.url))
  }

  // Redirect to home if accessing login while authenticated
  if (request.nextUrl.pathname === '/login' && user) {
    return NextResponse.redirect(new URL(home, request.url))
  }

  // Redirect root to login or home based on auth status
  if (request.nextUrl.pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL(home, request.url))
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
