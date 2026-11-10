import React from "react";

export default function BrandLogo({ className = "" }) {
  return (
    <span className={`brand-lockup ${className}`.trim()}>
      <svg className="brand-mark" viewBox="0 0 56 56" role="img" aria-label="RentEase home and key logo">
        <rect x="2" y="2" width="52" height="52" rx="15" fill="#dff3f0" stroke="#159c96" strokeWidth="2.5" />
        <path d="M12 27.5 28 15l16 12.5v15H32V32h-8v10.5H12z" fill="#102c3b" />
        <circle cx="37" cy="31" r="5.1" fill="#159c96" />
        <circle cx="37" cy="31" r="2" fill="#dff3f0" />
        <path d="M41.8 29.2h7.1a1.7 1.7 0 0 1 0 3.4h-1.6v2h-3v-2h-2.5z" fill="#159c96" />
      </svg>
      <span className="brand-wordmark"><span>Rent</span><strong>Ease</strong></span>
    </span>
  );
}
