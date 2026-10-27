import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { hasSupabase, SUPABASE_KEY, SUPABASE_URL } from './env';

/** 요청마다 만료된 세션 토큰을 갱신해 쿠키로 돌려준다 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabase) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet, headers) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  // createServerClient와 getClaims 사이에 다른 코드를 넣지 않는다(세션이 엇갈릴 수 있음)
  await supabase.auth.getClaims();
  return response;
}
