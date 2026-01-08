export default function BoltMark({ className = "" }) {
  return (
    <svg
      className={`bolt ${className}`}
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 2L3 14h7l-1 8 12-14h-7l-1-6z"
        fill="rgb(250, 204, 21)"
        opacity="0.95"
      />
      <path
        d="M13 2L3 14h7l-1 8 12-14h-7l-1-6z"
        stroke="rgba(30, 58, 138, 0.55)"
        strokeWidth="1"
      />
    </svg>
  );
}
