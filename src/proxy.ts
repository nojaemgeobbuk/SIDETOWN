import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { INVITE_COOKIE } from '@/lib/supabase/invite-cookie';

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // 로그인 코드가 콜백이 아닌 곳(예: Site URL로 되돌아온 첫 화면)으로 오면 콜백으로 넘겨 로그인을 마무리한다.
  // Supabase는 redirectTo가 허용 목록과 맞지 않으면 Site URL로 보내기 때문에 생기는 일
  const code = url.searchParams.get('code');
  if (code && url.pathname !== '/auth/callback') {
    const to = url.clone();
    to.pathname = '/auth/callback';
    to.search = '';
    to.searchParams.set('code', code);
    to.searchParams.set('next', url.pathname === '/' ? '/' : url.pathname);
    return NextResponse.redirect(to);
  }

  const response = await updateSession(request);

  // 초대 링크를 열면 1시간 동안 기억해 둔다. 로그인 중에 주소가 바뀌어도 마을 만들기 대신 초대로 돌아오게
  const m = url.pathname.match(/^\/invite\/([A-Za-z0-9]{16,128})$/);
  if (m) {
    response.cookies.set(INVITE_COOKIE, m[1], { path: '/', maxAge: 60 * 60, httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:png|jpg|jpeg|svg|webp|mp4|mp3|txt)$).*)'],
};
