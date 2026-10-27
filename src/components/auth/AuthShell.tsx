/** 로그인·마을 만들기·초대 화면의 공통 틀: 저녁 마을 장면 위의 카드 */
export default function AuthShell({ kicker, title, sub, children }: { kicker: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-bg" aria-hidden />
      <section className="auth-card">
        <span className="brand">SIDETOWN</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="pixel" style={{ fontSize: 11, color: 'var(--amber)', letterSpacing: 1 }}>{kicker}</span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', lineHeight: 1.3 }}>{title}</h1>
          {sub && <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{sub}</p>}
        </div>
        {children}
      </section>
    </main>
  );
}
