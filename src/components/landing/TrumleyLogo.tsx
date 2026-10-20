import React from 'react';

interface TrumleyLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
}

export function TrumleyIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div 
      className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#9EC29A] via-[#86B382] to-[#568053] shadow-md shadow-[#9EC29A]/25 text-white flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label="Trumley icon"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-3/5 h-3/5"
      >
        {/* Modern Stylized 'T' with growth stem and academic spark */}
        <path
          d="M6 9.5C6 8.11929 7.11929 7 8.5 7H23.5C24.8807 7 26 8.11929 26 9.5C26 10.3284 25.3284 11 24.5 11H18.5V23.5C18.5 24.8807 17.3807 26 16 26C14.6193 26 13.5 24.8807 13.5 23.5V11H7.5C6.67157 11 6 10.3284 6 9.5Z"
          fill="white"
        />
        {/* Sparkle node on top right representing AI intelligence */}
        <path
          d="M23 4L23.7 5.8L25.5 6.5L23.7 7.2L23 9L22.3 7.2L20.5 6.5L22.3 5.8L23 4Z"
          fill="#FDE74C"
        />
        {/* Subtle inner leaf curve */}
        <path
          d="M13.5 17C13.5 17 11 19 11 21C11 22.1046 11.8954 23 13 23C13.5 23 13.5 22 13.5 22"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function TrumleyLogo({
  className = '',
  iconOnly = false,
  size = 'md',
  showBadge = false,
}: TrumleyLogoProps) {
  const iconSizes = {
    sm: 28,
    md: 34,
    lg: 42,
    xl: 52,
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <TrumleyIcon size={iconSizes[size]} />
      {!iconOnly && (
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white leading-none ${textSizes[size]}`}>
              Trumley
            </span>
          </div>
          {showBadge && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#9EC29A]/15 text-[#3b6337] dark:text-[#C5E8C2] border border-[#9EC29A]/30">
              AI Study Engine
            </span>
          )}
        </div>
      )}
    </div>
  );
}
