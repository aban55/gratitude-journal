// src/pages/Privacy.jsx
import React from "react";

export default function Privacy() {
  return (
    <div className="page-container" style={{ padding: "2rem", maxWidth: "800px", margin: "auto" }}>
      <h1>Privacy Policy</h1>
      <p>
        Gratitude Journal respects your privacy and is committed to protecting your personal data.
        We only collect basic information necessary to provide our services — such as your name and
        email address when you sign in with Google. This data is used solely to personalize your
        experience and synchronize your journal entries securely with your Google account.
      </p>
      <p>
        Your information is never sold, shared, or disclosed to third parties. If the app connects to
        your Google Drive or Sheets, it only accesses the specific files it creates or that you
        explicitly choose to share. All authorization is handled securely through Google Identity
        Services. You may revoke permissions at any time from your Google Account settings.
      </p>
      <p>
        This app is for personal and educational use, and data is processed in accordance with Google’s
        Privacy Policy and Terms of Service.
      </p>
      <p>Last updated: November 2025</p>
    </div>
  );
}
