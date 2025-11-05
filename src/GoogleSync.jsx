import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";
window.gapi = gapi;

const CLIENT_ID =
  "814388665595-1hh28db0l55nsposkvco1dcva0ssje2r.apps.googleusercontent.com";
const API_KEY = "";
const SCOPES =
  "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

export default function GoogleSync({ dataToSync }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [status, setStatus] = useState("");

  // ---- Initialize Google API ----
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

          // Listen for sign-in changes
          auth.isSignedIn.listen(setIsSignedIn);

          // If already signed in
          const signedIn = auth.isSignedIn.get();
          setIsSignedIn(signedIn);

          if (signedIn) {
            const user = auth.currentUser.get();
            const profile = user.getBasicProfile();
            setUserProfile({
              name: profile.getName(),
              email: profile.getEmail(),
              image: profile.getImageUrl(),
            });

            // Auto-restore from Drive
            restoreFromDrive();
          }
        })
        .catch((err) => console.error("GAPI init error:", err));
    }

    gapi.load("client:auth2", initClient);
  }, []);

  // ---- Upload to Google Drive ----
  const backupToDrive = async () => {
    if (!isSignedIn) {
      setStatus("Please sign in first.");
      return;
    }
    try {
      setStatus("Backing up to Drive...");

      const fileContent = JSON.stringify(dataToSync, null, 2);
      const file = new Blob([fileContent], { type: "application/json" });
      const metadata = {
        name: "gratitude_journal_backup.json",
        parents: ["appDataFolder"],
      };

      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      form.append("file", file);

      const accessToken = gapi.auth.getToken().access_token;
      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: new Headers({ Authorization: "Bearer " + accessToken }),
          body: form,
        }
      );

      if (res.ok) {
        setStatus("✅ Backup successful!");
      } else {
        setStatus("❌ Backup failed.");
      }
    } catch (error) {
      console.error(error);
      setStatus("❌ Error during backup.");
    }
  };

  // ---- Restore from Drive ----
  const restoreFromDrive = async () => {
    try {
      setStatus("Restoring from Drive...");
      const response = await gapi.client.drive.files.list({
        spaces: "appDataFolder",
        fields: "files(id, name, modifiedTime)",
      });

      const files = response.result.files;
      if (files && files.length > 0) {
        // Get the most recent backup
        const latest = files.reduce((a, b) =>
          new Date(a.modifiedTime) > new Date(b.modifiedTime) ? a : b
        );

        const file = await gapi.client.drive.files.get({
          fileId: latest.id,
          alt: "media",
        });

        const restoredData = JSON.parse(file.body);
        localStorage.setItem("gratitudeEntries", JSON.stringify(restoredData.savedEntries || []));
        localStorage.setItem("savedAffirmations", JSON.stringify(restoredData.savedAffirmations || []));

        setStatus("✅ Restored successfully!");
      } else {
        setStatus("No backup found on Drive.");
      }
    } catch (error) {
      console.error("Restore error:", error);
      setStatus("❌ Restore failed.");
    }
  };

  // ---- UI ----
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
          <div>
            <p className="font-medium">{userProfile?.name}</p>
            <p className="text-sm text-gray-500">{userProfile?.email}</p>
          </div>

          <div className="flex gap-3 mt-3">
            <button
              onClick={backupToDrive}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Backup
            </button>
            <button
              onClick={restoreFromDrive}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Restore
            </button>
            <button
              onClick={() => gapi.auth2.getAuthInstance().signOut()}
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => gapi.auth2.getAuthInstance().signIn()}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Sign in with Google Drive
        </button>
      )}

      {status && <p className="text-sm mt-3 text-gray-600">{status}</p>}
    </div>
  );
}
