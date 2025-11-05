// src/GoogleSync.jsx
import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";

const CLIENT_ID =
  "814388665595-1hh28db0l55nsposkvco1dcva0ssje2r.apps.googleusercontent.com";
const API_KEY = "";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export default function GoogleSync({ dataToSync }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");

  // --- initialize gapi ---
  useEffect(() => {
    function start() {
      gapi.client
        .init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
          ],
        })
        .then(() => {
          const auth = gapi.auth2.getAuthInstance();

          // Listen for sign-in state changes
          auth.isSignedIn.listen(setIsSignedIn);

          // Handle initial state
          const current = auth.currentUser.get();
          if (current && current.isSignedIn()) {
            const profile = current.getBasicProfile();
            setUser({
              name: profile.getName(),
              email: profile.getEmail(),
              image: profile.getImageUrl(),
            });
            setIsSignedIn(true);
          }
        })
        .catch((err) => console.error("GAPI init failed", err));
    }

    gapi.load("client:auth2", start);
  }, []);

  const signIn = async () => {
    try {
      const auth = gapi.auth2.getAuthInstance();
      await auth.signIn();
      const profile = auth.currentUser.get().getBasicProfile();
      setUser({
        name: profile.getName(),
        email: profile.getEmail(),
        image: profile.getImageUrl(),
      });
      setIsSignedIn(true);
    } catch (err) {
      console.error("Sign-in error:", err);
    }
  };

  const signOut = () => {
    const auth = gapi.auth2.getAuthInstance();
    auth.signOut();
    setUser(null);
    setIsSignedIn(false);
  };

  // --- sync to Drive ---
  const uploadToDrive = async () => {
    setSyncStatus("uploading");
    const content = JSON.stringify(dataToSync, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const metadata = {
      name: "gratitude_journal_backup.json",
      mimeType: "application/json",
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", blob);

    try {
      await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: new Headers({
            Authorization: "Bearer " + gapi.auth.getToken().access_token,
          }),
          body: form,
        }
      );
      setSyncStatus("done");
      alert("✅ Journal synced to Google Drive!");
    } catch (err) {
      console.error("Drive upload error:", err);
      setSyncStatus("error");
    }
  };

  return (
    <div className="mt-6 text-center">
      <h3 className="font-semibold text-green-700 mb-2">
        🌤 Google Drive Sync
      </h3>

      {!isSignedIn ? (
        <button
          onClick={signIn}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          Sign in with Google Drive
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <img
              src={user?.image}
              alt="profile"
              className="w-8 h-8 rounded-full"
            />
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>

          <div className="flex justify-center gap-3 mt-2">
            <button
              onClick={uploadToDrive}
              disabled={syncStatus === "uploading"}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
            >
              {syncStatus === "uploading" ? "Syncing..." : "Sync to Drive"}
            </button>
            <button
              onClick={signOut}
              className="bg-gray-300 text-gray-800 px-3 py-2 rounded hover:bg-gray-400"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
