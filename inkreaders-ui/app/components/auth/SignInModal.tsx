// app/components/auth/SignInModal.tsx
"use client";

import Modal from "../ui/Modal";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

// Inline SVG for the Google "G" icon - Replaced with a cleaner, more standard version for better clarity at small sizes.
const GoogleIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 533.5 544.3" 
    width="20px" 
    height="20px" 
    className="mr-3"
  >
    {/* Blue path */}
    <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-35.8-4.7-52.1H268.9v100.2h147.9c-6.7 34.6-26.6 65.6-56.1 86.4l-31.5 30.2v72.5h93.5c54.7-50.5 86.5-124.6 86.5-217z"/>
    {/* Green path */}
    <path fill="#34A853" d="M268.9 544.3c71.6 0 131.5-23.7 175.4-64.4l-93.5-72.5c-25.9 17.5-59.4 28-91.9 28-70.5 0-130.4-48-152.2-113.8l-32.5 25.1v76.8c34.9 69.3 103.6 118.6 187.8 118.6z"/>
    {/* Yellow path */}
    <path fill="#FBBC05" d="M116.7 328.7c-5.7-17.5-9-36.2-9-56.1s3.2-38.6 9-56.1v-76.8l-32.5-25.1v76.8c-29.4 58.7-29.4 126.8 0 185.5z"/>
    {/* Red path */}
    <path fill="#E84F3D" d="M268.9 157.9c41 0 77.4 14.1 106.2 41.5l83.1-80.1c-49.4-46.7-113.8-75.7-189.3-75.7C165.2 43.6 7.6 137.9 7.6 278.4h111.4c21.8-65.8 81.7-113.8 152.2-113.8z"/>
  </svg>
);


export default function SignInModal({
  open,
  onClose,
  redirectUrl, 
}: {
  open: boolean;
  onClose: () => void;
  redirectUrl?: string; 
}) {
  if (!open) return null;

  function handleGoogleLogin() {
    // Construct the base URL
    let url = `${API_BASE}/api/auth/oauth/google/start`;

    // Append the redirect URL as a query parameter
    if (redirectUrl) {
      url += `?redirect_to=${encodeURIComponent(redirectUrl)}`;
    }
    
    // Redirect to backend OAuth start endpoint
    window.location.href = url;
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 mb-2 rounded-full bg-white flex items-center justify-center border shadow-inner">
             {/* App logo/icon placeholder */}
             <span className="text-2xl text-blue-500" role="img" aria-label="Book">📖</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to InkReaders</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to start posting and engaging with content.</p>
        </div>
        
        {/* Sign-in Button */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            // Updated classes for a prominent hover effect: increased shadow, subtle background color change, and slight scale.
            // Active state (click) is also darkened for better tactile feedback.
            className="flex items-center justify-center w-full rounded-xl px-4 py-3 text-center font-bold bg-white text-blue-600 transition-all duration-200 border-2 border-blue-500 shadow-md 
            hover:border-blue-700 hover:text-blue-700 hover:shadow-lg hover:bg-blue-50 hover:scale-[1.01] transform
            focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-blue-100 active:text-blue-800"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        {/* Footer Text */}
        <p className="text-xs text-gray-400 text-center pt-2">
          By continuing, you agree to our 
          <a href="/terms" target="_blank" className="font-medium text-gray-500 hover:underline ml-1">Terms</a> and 
          <a href="/privacy" target="_blank" className="font-medium text-gray-500 hover:underline ml-1">Privacy Policy</a>.
        </p>
      </div>
    </Modal>
  );
}
