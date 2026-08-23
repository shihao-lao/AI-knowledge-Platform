import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/shared/session-token';

const PUBLIC_PAGES = ['/login', '/register'];
const PUBLIC_API_PREFIX = '/api/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const isAuthed = payload !== null;

  const isApi = pathname.startsWith('/api');
  const isPublicPage = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isPublicApi = pathname.startsWith(PUBLIC_API_PREFIX);

  if (isApi) {
    if (!isPublicApi && !isAuthed) {
      return NextResponse.json({ error: '未登录或会话已过期' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 页面路由
  if (!isAuthed && !isPublicPage) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  if (isAuthed && isPublicPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)'],
};
