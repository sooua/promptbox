export default function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M3 12C3 11.3649 3.46571 10.85 4.0402 10.85H19.9598C20.5343 10.85 21 11.3649 21 12C21 12.6351 20.5343 13.15 19.9598 13.15H4.0402C3.46571 13.15 3 12.6351 3 12Z"
        fill="currentColor"
      />
      <path
        d="M12 21C11.3649 21 10.85 20.5343 10.85 19.9598V4.0402C10.85 3.46571 11.3649 3 12 3C12.6351 3 13.15 3.46571 13.15 4.0402V12V19.9598C13.15 20.5343 12.6351 21 12 21Z"
        fill="currentColor"
      />
    </svg>
  )
}