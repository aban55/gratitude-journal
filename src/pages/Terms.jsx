// src/pages/Terms.jsx
import React from "react";

export default function Terms() {
  return (
    <div className="page-container" style={{ padding: "2rem", maxWidth: "800px", margin: "auto" }}>
      <h1>Terms of Use</h1>
      <p>
        By using Gratitude Journal, you agree to use the app responsibly and in accordance with these
        Terms. The app is provided as-is, without warranties of any kind, for personal reflection and
        wellbeing purposes. While we strive to keep the app reliable and secure, we cannot guarantee
        uninterrupted operation or data retention.
      </p>
      <p>
        Gratitude Journal uses Google Sign-In to authenticate users. By signing in, you consent to
        Google’s own Terms of Service and Privacy Policy. You remain the sole owner of your journal
        data and may delete your entries or revoke access at any time.
      </p>
      <p>
        We may update these Terms periodically. Continued use of the app after updates means you
        accept the revised terms.
      </p>
      <p>Last updated: November 2025</p>
    </div>
  );
}
