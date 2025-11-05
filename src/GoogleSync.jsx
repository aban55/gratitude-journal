import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";
import { Cloud, CloudOff, CloudUpload, CheckCircle, AlertTriangle } from "lucide-react"; // install: npm i lucide-react

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | queued | restoring | done | error

  // ---- Initialize GAPI ----
  useEffect(() => {
    const start = () => {
      gapi.client
        .init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        })
        .then(() => {
          const auth = gapi.auth2.getAuthInstance();
          auth.isSignedIn.listen(updateSigninStatus);
          updateSigninStatus(auth.isSignedIn.get());
        })
        .catch((err) => console.error("⚠️ GAPI init failed:", err));
    };
    gapi.load("client:auth2", start);
  }, []);

  // ---- Handle Sign-in state ----
  const updateSigninStatus = (signedIn) => {
    setIsSignedIn(signedIn);
    if (signedIn) {
      const profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
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

  const signIn = () => gapi.auth2.getAuthInstance().signIn();
  const signOut = () => gapi.auth2.getAuthInstance().signOut();

  // ---- Upload to Google Drive ----
  const uploadToDrive = async () => {
    setStatus("uploading");
    try {
      const content = JSON.stringify(dataToSync, null, 2);
      const blob = new Blob([content], { type: "application/json" });

      if (!navigator.onLine) {
        // queue upload if offline
        const db = await openDB();
        await db.put(
          "pending",
          {
            url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            method: "POST",
            headers: {
              Authorization: "Bearer " + gapi.auth.getToken().access_token,
            },
            body: blob,
          },
          "backup"
        );

        if ("serviceWorker" in navigator && "SyncManager" in window) {
          const reg = await navigator.serviceWorker.ready;
          await reg.sync.register("sync-gratitude-upload");
          setStatus("queued");
          alert("🕓 Offline — will auto-upload when online.");
        } else {
          alert("Offline. Backup will sync next time you open the app.");
          setStatus("idle");
        }
        return;
      }

      // Online upload
      const metadata = { name: "gratitude_journal_backup.json", mimeType: "application/json" };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", blob);

      await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: new Headers({
          Authorization: "Bearer " + gapi.auth.getToken().access_token,
        }),
        body: form,
      });

      setStatus("done");
      alert("✅ Synced successfully to Google Drive!");
    } catch (err) {
      console.error("Upload failed:", err);
      setStatus("error");
    }
  };

  // ---- Auto-restore from Drive ----
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
      if (onRestore && restoredData) onRestore(restoredData);
      setStatus("done");
    } catch (err) {
      console.error("Restore failed:", err);
      setStatus("error");
    }
  };

  // ---- IndexedDB helper ----
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("gratitude-sync", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("pending");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---- UI ----
  const renderStatusIcon = () => {
    switch (status) {
      case "uploading":
        return <CloudUpload className="animate-bounce text-blue-600" size={22} />;
      case "queued":
        return <CloudOff className="text-yellow-500 animate-pulse" size={22} />;
      case "restoring":
        return <Cloud className="animate-pulse text-green-500" size={22} />;
      case "done":
        return <CheckCircle className="text-green-600" size={22} />;
      case "error":
        return <AlertTriangle className="text-red-600" size={22} />;
      default:
        return <Cloud className="text-gray-500" size={22} />;
    }
  };

  return (
    <div className="mt-8 text-center border-t pt-4">
      <h3 className="font-semibold text-green-700 mb-2 flex items-center justify-center gap-2">
        ☁️ Google Drive Sync {renderStatusIcon()}
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
            <img src={user?.image} alt="profile" className="w-8 h-8 rounded-full" />
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>

          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={uploadToDrive}
              disabled={status === "uploading"}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <CloudUpload size={18} />
              {status === "uploading" ? "Syncing..." : "Upload Backup"}
            </button>
            <button
              onClick={signOut}
              className="bg-gray-300 text-gray-800 px-3 py-2 rounded hover:bg-gray-400"
            >
              Sign Out
            </button>
          </div>

          {status === "queued" && (
            <p className="text-sm text-yellow-600 mt-2">
              🕓 Queued – will sync when you're back online
            </p>
          )}
          {status === "done" && (
            <p className="text-sm text-green-600 mt-2">✅ Drive is up to date</p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-600 mt-2">⚠️ Sync failed – try again</p>
          )}
        </div>
      )}
    </div>
  );
}
