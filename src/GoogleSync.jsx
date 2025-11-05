import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";

// === CONFIGURATION ===
const CLIENT_ID =
  "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc"; // <-- paste your new restricted key
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | restoring | done | error

  // ---- Initialize Google API ----
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
          auth.isSignedIn.listen(updateSigninStatus);
          updateSigninStatus(auth.isSignedIn.get());
        })
        .catch((err) => console.error("⚠️ GAPI init failed:", err));
    }
    gapi.load("client:auth2", start);
  }, []);

  // ---- Update Sign-in State ----
  const updateSigninStatus = (signedIn) => {
    setIsSignedIn(signedIn);
    if (signedIn) {
      const profile = gapi.auth2
        .getAuthInstance()
        .currentUser.get()
        .getBasicProfile();
      setUser({
        name: profile.getName(),
        email: profile.getEmail(),
        image: profile.getImageUrl(),
      });
      autoRestoreFromDrive();
    } else {
      setUser(null);
    }
  };

  // ---- Sign In / Out ----
  const signIn = () => gapi.auth2.getAuthInstance().signIn();
  const signOut = () => gapi.auth2.getAuthInstance().signOut();

  // ---- Upload Backup ----
  const uploadToDrive = async () => {
    setStatus("uploading");
    try {
      const content = JSON.stringify(dataToSync, null, 2);
      const blob = new Blob([content], { type: "application/json" });

      const searchResponse = await gapi.client.drive.files.list({
        q: "name='gratitude_journal_backup.json'",
        fields: "files(id, name)",
      });

      const fileId = searchResponse.result.files?.[0]?.id;

      if (fileId) {
        await gapi.client.request({
          path: `/upload/drive/v3/files/${fileId}`,
          method: "PATCH",
          params: { uploadType: "media" },
          body: blob,
        });
      } else {
        const metadata = {
          name: "gratitude_journal_backup.json",
          mimeType: "application/json",
        };
        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(metadata)], {
            type: "application/json",
          })
        );
        form.append("file", blob);
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
      }

      setStatus("done");
      alert("✅ Synced successfully to Google Drive!");
    } catch (err) {
      console.error("❌ Upload failed:", err);
      setStatus("error");
    }
  };

  // ---- Auto Restore from Drive ----
  const autoRestoreFromDrive = async () => {
    try {
      setStatus("restoring");
      const searchResponse = await gapi.client.drive.files.list({
        q: "name='gratitude_journal_backup.json'",
        fields: "files(id, name)",
      });
      const file = searchResponse.result.files?.[0];
      if (!file) {
        setStatus("idle");
        return;
      }
      const downloadResponse = await gapi.client.drive.files.get({
        fileId: file.id,
        alt: "media",
      });
      const restoredData = downloadResponse.result;
      if (onRestore && restoredData) {
        onRestore(restoredData);
        console.log("✅ Auto-restored from Drive");
      }
      setStatus("done");
    } catch (err) {
      console.error("❌ Restore failed:", err);
      setStatus("error");
    }
  };

  // ---- UI ----
  return (
    <div className="mt-6 text-center">
      <h3 className="font-semibold text-green-700 mb-2">
        ☁️ Google Drive Sync
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
              disabled={status === "uploading"}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
            >
              {status === "uploading" ? "Syncing..." : "Upload Backup"}
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

      {status === "restoring" && (
        <p className="text-sm text-gray-500 mt-2">🔄 Restoring from Drive...</p>
      )}
      {status === "done" && (
        <p className="text-sm text-green-600 mt-2">✅ Up to date</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-600 mt-2">
          ⚠️ Sync failed. Please retry or check console.
        </p>
      )}
    </div>
  );
}
