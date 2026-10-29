import { NextResponse } from 'next/server';
import { INVITE_COOKIE } from '@/lib/supabase/invite-cookie';

/** 초대를 수락했거나 쓸 수 없는 링크였을 때: 기억해 둔 초대를 지우고 마을로 */
export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL('/', request.url));
  res.cookies.set(INVITE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
