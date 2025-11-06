import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * GoogleSync.jsx
 * - Stores backups in user's My Drive (gratitude_journal_backup.json)
 * - Auto restores sign-in silently (prompt:'')
 * - Refreshes tokens every 55 minutes
 * - Adds Sync Status Banner + "Last Restored" timestamp
 * - Works fully offline via localStorage + JSON import/export
 */

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const BACKUP_NAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem("gj_access_token") || null);
  const [user, setUser] = useState(null);
  const [backupFile, setBackupFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | syncing | up_to_date | error | offline
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastRestoreTime, setLastRestoreTime] = useState(
    localStorage.getItem("gj_last_restore") || null
  );

  const [gapiReady, setGapiReady] = useState(false);
  const [driveReady, setDriveReady] = useState(false);
  const [message, setMessage] = useState("");
  const tokenClientRef = useRef(null);

  const isSignedIn = useMemo(() => !!accessToken, [accessToken]);
  const log = (...a) => console.log("[GoogleSync]", ...a);

  // -------------------- Scripts --------------------
  const ensureGoogleIdentityScript = () =>
    new Promise((resolve) => {
      if (window.google?.accounts) return resolve();
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      document.head.appendChild(s);
    });

  const ensureGapiClient = () =>
    new Promise((resolve, reject) => {
      if (window.gapi?.client) return resolve();
      const s = document.createElement("script");
      s.src = "https://apis.google.com/js/api.js";
      s.async = true;
      s.onload = async () => {
        try {
          await window.gapi.load("client", async () => {
            await window.gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: [
                "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
              ],
            });
            resolve();
          });
        } catch (err) {
          reject(err);
        }
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });

  // -------------------- Auth --------------------
  const initTokenClient = () => {
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      prompt: "", // silent reauth
      callback: (resp) => {
        if (resp?.access_token) {
          setAccessToken(resp.access_token);
          localStorage.setItem("gj_access_token", resp.access_token);
          fetchUserProfile(resp.access_token);
        }
      },
    });
  };

  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) throw new Error("Token expired");
      const profile = await res.json();
      setUser(profile);
      log("Signed in:", profile);
      await locateBackup();
    } catch (e) {
      log("Profile fetch failed:", e);
      tokenClientRef.current?.requestAccessToken({ prompt: "" });
    }
  };

  // -------------------- Drive --------------------
  const locateBackup = async () => {
    try {
      const res = await window.gapi.client.drive.files.list({
        q: `name='${BACKUP_NAME}' and trashed=false`,
        fields: "files(id, name, modifiedTime)",
        spaces: "drive",
        corpora: "user",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      const files = res.result?.files || [];
      setBackupFile(files[0] || null);
      return files[0] || null;
    } catch (err) {
      log("locateBackup error:", err);
      setStatus("error");
      return null;
    }
  };

  const uploadToDrive = async () => {
    if (!isSignedIn) return;
    setStatus("syncing");
    try {
      const payload = JSON.stringify(dataToSync || {}, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const headers = { Authorization: `Bearer ${accessToken}` };
      const existing = backupFile || (await locateBackup());

      if (existing?.id) {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
          { method: "PATCH", headers, body: blob }
        );
      } else {
        const meta = { name: BACKUP_NAME, mimeType: "application/json" };
        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
        form.append("file", blob);
        await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
          { method: "POST", headers, body: form }
        );
      }
      await locateBackup();
      setLastSyncTime(Date.now());
      setStatus("up_to_date");
    } catch (e) {
      log("upload error:", e);
      setStatus("error");
    }
  };

  const restoreFromDrive = async () => {
    if (!isSignedIn) return alert("Please sign in first.");
    setStatus("syncing");
    try {
      const file = backupFile || (await locateBackup());
      if (!file?.id) {
        setStatus("idle");
        alert("No backup found on Drive.");
        return;
      }
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const json = await res.json();
      onRestore?.(json);
      const now = Date.now();
      setLastRestoreTime(now);
      localStorage.setItem("gj_last_restore", now);
      setStatus("up_to_date");
    } catch (e) {
      log("restore error:", e);
      setStatus("error");
    }
  };

  const signIn = () => tokenClientRef.current?.requestAccessToken({ prompt: "consent" });
  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
    setBackupFile(null);
    setStatus("offline");
  };

  // -------------------- Local Backup --------------------
  const exportLocal = () => {
    const payload = JSON.stringify(dataToSync || {}, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = BACKUP_NAME;
    a.click();
  };

  const importLocal = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const json = JSON.parse(await file.text());
      onRestore?.(json);
      const now = Date.now();
      setLastRestoreTime(now);
      localStorage.setItem("gj_last_restore", now);
      setStatus("up_to_date");
      alert("✅ Restored from local file");
    } catch (err) {
      setStatus("error");
      log("Local import failed:", err);
    }
    e.target.value = "";
  };

  // -------------------- Init --------------------
  useEffect(() => {
    (async () => {
      try {
        await ensureGoogleIdentityScript();
        await ensureGapiClient();
        initTokenClient();
        setGapiReady(true);
        setDriveReady(true);
        const saved = localStorage.getItem("gj_access_token");
        if (saved) await fetchUserProfile(saved);
        else tokenClientRef.current.requestAccessToken({ prompt: "" });
      } catch (e) {
        log("Init error:", e);
      }
    })();
  }, []);

  // Refresh token every 55 min
  useEffect(() => {
    if (!accessToken || !tokenClientRef.current) return;
    const t = setInterval(() => {
      tokenClientRef.current.requestAccessToken({ prompt: "" });
    }, 55 * 60 * 1000);
    return () => clearInterval(t);
  }, [accessToken]);

  // Auto-upload debounce
  useEffect(() => {
    if (!isSignedIn || !driveReady) return;
    const t = setTimeout(() => uploadToDrive(), 3000);
    return () => clearTimeout(t);
  }, [JSON.stringify(dataToSync)]);

  // -------------------- UI Logic --------------------
  const timeAgo = (ts) => {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return "just now";
    if (diff === 1) return "1 min ago";
    if (diff < 60) return `${diff} mins ago`;
    const hrs = Math.floor(diff / 60);
    return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  };

  const bannerColor =
    status === "up_to_date"
      ? "bg-green-100 text-green-700 border-green-300"
      : status === "syncing"
      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
      : status === "error"
      ? "bg-red-100 text-red-700 border-red-300"
      : "bg-gray-100 text-gray-600 border-gray-300";

  return (
    <div className="space-y-4">
      {/* ✅ Sync Status Banner */}
      <div className={`border rounded-md p-2 text-center text-sm font-medium ${bannerColor}`}>
        {status === "up_to_date" && (
          <>
            ☁️ Synced to Drive {timeAgo(lastSyncTime) || "recently"}
            {lastRestoreTime && (
              <div className="text-xs text-gray-500">
                Last restored {timeAgo(lastRestoreTime)}
              </div>
            )}
          </>
        )}
        {status === "syncing" && <>🔄 Syncing with Drive…</>}
        {status === "error" && <>⚠️ Error syncing. Using local backup.</>}
        {!isSignedIn && <>⚠️ Not signed in – local only</>}
      </div>

      {/* Account & Sync Controls */}
      <div className="rounded-xl border p-4">
        <h3 className="font-semibold text-green-700 mb-2">☁️ Google Drive Sync</h3>

        {!isSignedIn ? (
          <button
            onClick={signIn}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              {user?.picture && (
                <img src={user.picture} alt="pfp" className="w-8 h-8 rounded-full" />
              )}
              <div className="text-sm">
                <div className="font-medium">{user?.name}</div>
                <div className="text-gray-500">{user?.email}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={uploadToDrive}
                className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
              >
                Upload Backup
              </button>
              <button
                onClick={restoreFromDrive}
                className="bg-white border px-3 py-2 rounded hover:bg-gray-50"
              >
                Restore from Drive
              </button>
              <button
                onClick={signOut}
                className="bg-gray-300 text-gray-800 px-3 py-2 rounded hover:bg-gray-400"
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Local Backup */}
      <div className="rounded-xl border p-4">
        <h3 className="font-semibold text-gray-800 mb-2 dark:text-gray-100">💾 Local Backup</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportLocal}
            className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
          >
            Export JSON
          </button>
          <label className="bg-white border px-3 py-2 rounded cursor-pointer hover:bg-gray-50">
            Import JSON
            <input type="file" accept="application/json" onChange={importLocal} hidden />
          </label>
          <span className="text-xs text-gray-500">
            Offline? Export or import manually anytime.
          </span>
        </div>
      </div>
    </div>
  );
}
