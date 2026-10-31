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
export const IconMail = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 18, height: 18, ...p })}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>);
export const IconCup = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" /></svg>);
export const IconTrophy = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" /></svg>);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, strokeWidth: 2, ...p })}><path d="M12 5v14M5 12h14" /></svg>);
export const IconEdit = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, ...p })}><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13 7l4 4" /></svg>);
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, ...p })}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>);
export const IconPin = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, ...p })}><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" /></svg>);
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, strokeWidth: 2, ...p })}><path d="M9 6l6 6-6 6" /></svg>);
export const IconDown = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 14, height: 14, strokeWidth: 2, ...p })}><path d="M6 9l6 6 6-6" /></svg>);
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, ...p })}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>);
export const IconMove = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, strokeWidth: 2, ...p })}><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" /></svg>);
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>);
