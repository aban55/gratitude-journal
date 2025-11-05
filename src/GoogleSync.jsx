import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";

const CLIENT_ID =
  "814388665595-1hh28db0l55nsposkvco1dcva0ssje2r.apps.googleusercontent.com";
const API_KEY = ""; // Optional, leave blank if not required
const SCOPES =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
const BACKUP_FILENAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onUserSignedIn }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [status, setStatus] = useState(""); // syncing | restoring | done | error
  const [loadingText, setLoadingText] = useState("");
  const [progress, setProgress] = useState(0);

  // ---- Initialize Google API ----
  useEffect(() => {
    async function initClient() {
      await gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: [
          "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
        ],
        scope: SCOPES,
      });

      const auth = gapi.auth2.getAuthInstance();

      const updateSigninStatus = async (isSignedIn) => {
        setIsSignedIn(isSignedIn);
        if (isSignedIn) {
          try {
            const googleUser = auth.currentUser.get();
            const accessToken = googleUser.getAuthResponse(true).access_token;
            const userInfo = await gapi.client.request({
              path: "https://www.googleapis.com/oauth2/v3/userinfo",
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            const email = userInfo.result.email || "";
            setUserEmail(email);
            onUserSignedIn?.({ email });
            restoreFromDrive();
          } catch (err) {
            console.error("User info fetch failed:", err);
          }
        } else {
          setUserEmail("");
        }
      };

      updateSigninStatus(auth.isSignedIn.get());
      auth.isSignedIn.listen(updateSigninStatus);
    }

    gapi.load("client:auth2", initClient);
  }, []);

  // ---- Progress animation ----
  const animateProgress = (target) => {
    setProgress(0);
    let val = 0;
    const interval = setInterval(() => {
      val += 10;
      setProgress(Math.min(val, target));
      if (val >= target) clearInterval(interval);
    }, 60);
  };

  // ---- Restore from Drive ----
  const restoreFromDrive = async () => {
    try {
      setStatus("restoring");
      setLoadingText("☁️ Restoring your journal...");
      animateProgress(70);

      const res = await gapi.client.drive.files.list({
        q: `name='${BACKUP_FILENAME}' and trashed=false`,
        fields: "files(id, name)",
      });

      if (res.result.files && res.result.files.length > 0) {
        const fileId = res.result.files[0].id;
        const file = await gapi.client.drive.files.get({
          fileId,
          alt: "media",
        });

        if (file.body) {
          const parsed = JSON.parse(file.body);
          if (parsed.savedEntries && parsed.savedAffirmations) {
            localStorage.setItem(
              "gratitudeEntries",
              JSON.stringify(parsed.savedEntries)
            );
            localStorage.setItem(
              "savedAffirmations",
              JSON.stringify(parsed.savedAffirmations)
            );
            setStatus("done");
            animateProgress(100);
            setLoadingText("✅ Journal restored successfully!");
            setTimeout(() => setLoadingText(""), 3000);
            window.location.reload();
          }
        }
      } else {
        setStatus("done");
        animateProgress(100);
        setLoadingText("No backup found — will create one soon.");
        setTimeout(() => setLoadingText(""), 3000);
      }
    } catch (err) {
      console.error("Drive restore error:", err);
      setStatus("error");
      setLoadingText("⚠️ Restore failed. Please check console.");
    }
  };

  // ---- Save to Drive whenever data changes ----
  useEffect(() => {
    if (!isSignedIn || status === "restoring") return;

    const saveToDrive = async () => {
      try {
        setStatus("syncing");
        animateProgress(80);
        setLoadingText("🔄 Syncing to Drive...");

        const res = await gapi.client.drive.files.list({
          q: `name='${BACKUP_FILENAME}' and trashed=false`,
          fields: "files(id, name)",
        });

        const content = JSON.stringify(dataToSync, null, 2);
        const blob = new Blob([content], { type: "application/json" });
        const metadata = {
          name: BACKUP_FILENAME,
          mimeType: "application/json",
        };

        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(metadata)], { type: "application/json" })
        );
        form.append("file", blob);

        if (res.result.files && res.result.files.length > 0) {
          const fileId = res.result.files[0].id;
          await gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: "PATCH",
            params: { uploadType: "multipart" },
            body: form,
          });
        } else {
          await gapi.client.request({
            path: "/upload/drive/v3/files",
            method: "POST",
            params: { uploadType: "multipart" },
            body: form,
          });
        }

        setStatus("done");
        animateProgress(100);
        setLoadingText("✅ Synced successfully!");
        setTimeout(() => setLoadingText(""), 3000);
      } catch (err) {
        console.error("Error saving to Drive:", err);
        setStatus("error");
        setLoadingText("⚠️ Sync failed. Check console.");
      }
    };

    const debounce = setTimeout(saveToDrive, 1000);
    return () => clearTimeout(debounce);
  }, [dataToSync, isSignedIn]);

  const handleSignIn = () => gapi.auth2.getAuthInstance().signIn();
  const handleSignOut = () => {
    gapi.auth2.getAuthInstance().signOut();
    setUserEmail("");
    setIsSignedIn(false);
  };

  // ---- UI ----
  return (
    <div className="mt-6 text-center relative">
      {!isSignedIn ? (
        <button
          onClick={handleSignIn}
          className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
        >
          Sign in with Google Drive
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-green-500">
            ✅ Synced as <strong>{userEmail}</strong>
          </p>

          {loadingText && (
            <p className="text-sm text-gray-600 animate-pulse">{loadingText}</p>
          )}

          {/* Animated progress bar */}
          {(status === "syncing" || status === "restoring") && (
            <div className="w-full max-w-xs mx-auto bg-gray-300 h-2 rounded overflow-hidden">
              <div
                className="bg-green-500 h-2 transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-400 text-sm"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
