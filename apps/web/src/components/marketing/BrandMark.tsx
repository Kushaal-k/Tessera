export function BrandMark({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#18181b" />
      <g fill="#f4f4f5">
        <rect x="7" y="7" width="8" height="8" rx="2" />
        <rect x="17" y="7" width="8" height="8" rx="2" opacity="0.45" />
        <rect x="7" y="17" width="8" height="8" rx="2" opacity="0.72" />
        <rect x="17" y="17" width="8" height="8" rx="2" />
      </g>
    </svg>
  );
}
