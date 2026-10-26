import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true, ...p });

export const IconTown = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 21V10l9-6 9 6v11" /><path d="M9 21v-6h6v6" /></svg>);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>);
export const IconList = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>);
export const IconAlbum = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>);
export const IconUser = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ strokeWidth: 2, ...p })}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconFlag = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, ...p })}><path d="M4 21V4h12l-2 4 2 4H4" /></svg>);
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 14, height: 14, fill: 'currentColor', stroke: 'none', ...p })}><path d="M7 4l13 8-13 8z" /></svg>);
export const IconPause = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 14, height: 14, fill: 'currentColor', stroke: 'none', ...p })}><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>);
export const IconSkip = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, fill: 'currentColor', stroke: 'none', ...p })}><path d="M5 4l10 8-10 8z" /><rect x="16" y="4" width="3" height="16" /></svg>);
export const IconExpand = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, strokeWidth: 2, ...p })}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
export const IconSpark = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, strokeWidth: 2, ...p })}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>);
