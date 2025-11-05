import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";

const CLIENT_ID =
  "814388665595-1hh28db0l55nsposkvco1dcva0ssje2r.apps.googleusercontent.com";
const API_KEY = "";
const SCOPES =
  "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

export default function GoogleSync({ dataToSync }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    function initClient() {
      gapi.client
        .init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
          ],
          scope: SCOPES,
        })
        .then(() => {
          const auth = gapi.auth2.getAuthInstance();
          // Listen for sign-in state changes
          auth.isSignedIn.listen(updateSigninStatus);
          // Handle initial state
          updateSigninStatus(auth.isSignedIn.get());
        })
        .catch((err) => {
          console.error("Google API init error:", err);
          setStatus("⚠️ Google Drive unavailable.");
        });
    }

    gapi.load("client:auth2", initClient);

    // Attempt silent login to restore previous session
    window.addEventListener("load", () => {
      gapi.load("auth2", () => {
        gapi.auth2
          .init({
            client_id: CLIENT_ID,
            scope: SCOPES,
          })
          .then(() => {
            const auth = gapi.auth2.getAuthInstance();
            if (auth.isSignedIn.get()) updateSigninStatus(true);
          });
      });
    });
  }, []);

  const updateSigninStatus = (isSignedIn) => {
    setIsSignedIn(isSignedIn);
    if (isSignedIn) {
      const user = gapi.auth2.getAuthInstance().currentUser.get();
      const profile = user.getBasicProfile();
      setUserProfile({
        name: profile.getName(),
        email: profile.getEmail(),
        image: profile.getImageUrl(),
      });
      setStatus("");
    }
  };

  const handleSignIn = () => gapi.auth2.getAuthInstance().signIn();
  const handleSignOut = () => gapi.auth2.getAuthInstance().signOut();

  return (
    <div className="text-center mt-8">
      <h3 className="text-lg font-semibold mb-2 text-green-600">
        ☁️ Google Drive Sync
      </h3>

      {isSignedIn ? (
        <div className="flex flex-col items-center gap-2">
          {userProfile?.image && (
            <img
              src={userProfile.image}
              alt="Profile"
              className="w-12 h-12 rounded-full border"
            />
          )}
          <div className="text-sm">
            <div className="font-medium">{userProfile?.name}</div>
            <div className="text-gray-500">{userProfile?.email}</div>
          </div>

          <button
            onClick={handleSignOut}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 mt-3"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          onClick={handleSignIn}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Sign in with Google Drive
        </button>
      )}

      {status && <p className="text-sm mt-3 text-gray-600">{status}</p>}
    </div>
  );
}
