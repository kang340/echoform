import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.45,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const Mic = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <rect x="9" y="2.5" width="6" height="12" rx="3" />
    <path d="M5.5 11.2a6.5 6.5 0 0 0 13 0M12 17.8v3.4M8.7 21.2h6.6" />
  </svg>
);

export const Stop = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.4" />
  </svg>
);

export const Upload = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M12 16V3.5M7.5 8 12 3.5 16.5 8" />
    <path d="M4 15.5v3.2A1.8 1.8 0 0 0 5.8 20.5h12.4a1.8 1.8 0 0 0 1.8-1.8v-3.2" />
  </svg>
);

export const Play = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="m8.3 5.5 10 6.5-10 6.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const Pause = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <rect x="7" y="5.2" width="3.2" height="13.6" rx="0.5" fill="currentColor" stroke="none" />
    <rect x="13.8" y="5.2" width="3.2" height="13.6" rx="0.5" fill="currentColor" stroke="none" />
  </svg>
);

export const Restart = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M4.5 9.2A8 8 0 1 1 4 14" />
    <path d="M4.4 4.6v4.9h4.9" />
  </svg>
);

export const Orbit = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="2.2" />
    <ellipse cx="12" cy="12" rx="9" ry="4.3" transform="rotate(-28 12 12)" />
    <circle cx="18.5" cy="7.1" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const Walk = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <circle cx="13.2" cy="4.2" r="1.7" />
    <path d="m11.2 8.1-2.8 4 2.7 2.1-1.2 5.2M11.2 8.1l3.1 2.1 2.7-.5M13.4 12.3l2.7 2.4 1.7 4.4M11.1 14.2l-1.2 4.8" />
  </svg>
);

export const Compass = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.6 8.4-2 5.2-5.2 2 2-5.2z" />
    <path d="M12 3v1.4M12 19.6V21M3 12h1.4M19.6 12H21" />
  </svg>
);

export const Camera = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M3.5 8.4h3.1l1.5-2.3h7.8l1.5 2.3h3.1v10.2h-17z" />
    <circle cx="12" cy="13.2" r="3.5" />
  </svg>
);

export const Video = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <rect x="3" y="6.2" width="12.5" height="11.6" rx="1.6" />
    <path d="m15.5 10 5-2.6v9.2l-5-2.6z" />
  </svg>
);

export const Share = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <circle cx="6.2" cy="12" r="2.4" />
    <circle cx="17.4" cy="5.8" r="2.4" />
    <circle cx="17.4" cy="18.2" r="2.4" />
    <path d="m8.4 10.8 6.8-3.8M8.4 13.2l6.8 3.8" />
  </svg>
);

export const Download = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5" />
    <path d="M4 17.5v1.2A1.8 1.8 0 0 0 5.8 20.5h12.4a1.8 1.8 0 0 0 1.8-1.8v-1.2" />
  </svg>
);

export const Sliders = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M4 6h8M16 6h4M4 12h3M11 12h9M4 18h9M17 18h3" />
    <circle cx="14" cy="6" r="1.8" />
    <circle cx="9" cy="12" r="1.8" />
    <circle cx="15" cy="18" r="1.8" />
  </svg>
);

export const Close = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
  </svg>
);

export const Chevron = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="m7 10 5 5 5-5" />
  </svg>
);

export const Volume = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M4 9.5v5h3.2l4.5 3.4V6.1L7.2 9.5z" />
    <path d="M15 8.4a5.2 5.2 0 0 1 0 7.2M17.8 6a8.7 8.7 0 0 1 0 12" />
  </svg>
);

export const VolumeOff = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M4 9.5v5h3.2l4.5 3.4V6.1L7.2 9.5zM15 9.4l5.2 5.2M20.2 9.4 15 14.6" />
  </svg>
);

export const Save = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M4 4.5h13.3L20 7.2v12.3H4z" />
    <path d="M8 4.5v5h8v-5M8 19.5v-6h8v6" />
  </svg>
);

export const Info = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10.7v5.4M12 7.4h.01" />
  </svg>
);

export const Spark = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M12 2.8c.8 5.7 3.5 8.4 9.2 9.2-5.7.8-8.4 3.5-9.2 9.2-.8-5.7-3.5-8.4-9.2-9.2 5.7-.8 8.4-3.5 9.2-9.2Z" />
  </svg>
);

export const ArrowRight = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M4 12h15M14 7l5 5-5 5" />
  </svg>
);

export const Fullscreen = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M8.5 4H4v4.5M15.5 4H20v4.5M20 15.5V20h-4.5M4 15.5V20h4.5" />
  </svg>
);

export const Trash = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M4.5 6.5h15M9.2 3.8h5.6M7 6.5l.8 13.2h8.4L17 6.5M10 10v6M14 10v6" />
  </svg>
);

export const Link = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="m9.4 14.6-1.6 1.6a3.7 3.7 0 0 1-5.2-5.2l3.2-3.2a3.7 3.7 0 0 1 5.2 0M14.6 9.4l1.6-1.6a3.7 3.7 0 1 1 5.2 5.2l-3.2 3.2a3.7 3.7 0 0 1-5.2 0M8.4 15.6l7.2-7.2" />
  </svg>
);

export const Music = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M9 18V5.5L20 3v12.4" />
    <circle cx="6.2" cy="18" r="2.8" />
    <circle cx="17.2" cy="15.4" r="2.8" />
  </svg>
);

export const Mouse = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <rect x="7" y="2.8" width="10" height="18.4" rx="5" />
    <path d="M12 6.2v4.4" />
  </svg>
);

export const Keyboard = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <rect x="2.5" y="6" width="19" height="12" rx="1.8" />
    <path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 12.5h.01M9.5 12.5h.01M13 12.5h.01M16.5 12.5h.01M7 15.4h10" />
  </svg>
);

export const Eye = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M2.8 12S6.2 6 12 6s9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

export const Folder = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="M3 6.3h7l1.7 2h9.3v10.4H3z" />
  </svg>
);

export const Check = ({ size = 20, ...props }: IconProps) => (
  <svg {...base(size)} {...props}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const Logo = ({ size = 28, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" {...props} aria-hidden>
    <circle cx="18" cy="18" r="12.5" stroke="currentColor" strokeWidth=".8" opacity=".55" />
    <path d="M18 4.5c6.2 2.8 9.5 7.3 9.5 13.5S24.2 28.7 18 31.5c-6.2-2.8-9.5-7.3-9.5-13.5S11.8 7.3 18 4.5Z" stroke="currentColor" strokeWidth=".7" />
    <path d="M4.8 18h26.4M8.7 9.3l18.6 17.4M27.3 9.3 8.7 26.7" stroke="currentColor" strokeWidth=".45" opacity=".55" />
    <circle cx="18" cy="18" r="2.1" fill="currentColor" />
  </svg>
);
