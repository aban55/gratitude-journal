import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * GoogleSync.jsx
 * - Stores backups in the user's *My Drive* (visible), file name: gratitude_journal_backup.json
 * - If not signed in, still provides Local Export/Import so users never lose data
 * - Props:
 *    - dataToSync: any serializable object (e.g., { entries })
 *    - onRestore(json): callback when a backup is restored (Drive or local)
 */

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const BACKUP_NAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onRestore }) {
  // Google auth/client state
  const [gapiReady, setGapiReady] = useState(false);
  const [driveReady, setDriveReady] = useState(false);
  const tokenClientRef = useRef(null);
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem("gj_access_token") || null
  );
  const [user, setUser] = useState(null);

  // UI state
  const [status, setStatus] = useState("idle"); // idle | uploading | restoring | up_to_date | error
  const [message, setMessage] = useState("");

  // Found backup metadata
  const [backupFile, setBackupFile] = useState(null); // { id, name, modifiedTime, mimeType }

  // ---- Helpers ---------------------------------------------------------------

  const log = (...args) => console.log("[GoogleSync]", ...args);

  const isSignedIn = useMemo(() => !!accessToken, [accessToken]);

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
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = async () => {
        try {
          await window.gapi.load("client", async () => {
            try {
              await window.gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: [
                  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
                ],
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        } catch (err) {
          reject(err);
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

  const initTokenClient = () => {
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp?.access_token) {
          setAccessToken(resp.access_token);
          localStorage.setItem("gj_access_token", resp.access_token);
          fetchUserProfile(resp.access_token);
        } else {
          setStatus("error");
          setMessage("Failed to get access token.");
        }
      },
    });
  };

  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await res.json();
      setUser(profile);
      log("Signed in as:", profile);
      // After sign-in, try to locate existing backup
      await locateBackup();
    } catch (e) {
      log("Profile fetch failed", e);
    }
  };

  // ---- Drive ops -------------------------------------------------------------

  const locateBackup = async () => {
    try {
      if (!window.gapi?.client) return;
      const res = await window.gapi.client.drive.files.list({
        q: `name='${BACKUP_NAME}' and trashed=false`,
        fields: "files(id, name, modifiedTime, mimeType)",
        spaces: "drive",
        corpora: "user",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: 10,
      });
      const files = res.result?.files || [];
      log("Drive search result:", files);
      setBackupFile(files[0] || null);
      return files[0] || null;
    } catch (e) {
      log("locateBackup error:", e);
      setStatus("error");
      setMessage("Unable to search Drive. Check API key & OAuth setup.");
      return null;
    }
  };

  const uploadToDrive = async () => {
    if (!isSignedIn) return alert("Please sign in first.");
    setStatus("uploading");
    setMessage("Syncing to Drive…");
    try {
      const payload = JSON.stringify(dataToSync || {}, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const headers = { Authorization: `Bearer ${accessToken}` };

      const existing = backupFile || (await locateBackup());

      if (existing?.id) {
        // Update file content
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
          { method: "PATCH", headers, body: blob }
        );
      } else {
        // Create new multipart file
        const metadata = {
          name: BACKUP_NAME,
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
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
          { method: "POST", headers, body: form }
        );
      }

      await locateBackup(); // refresh metadata
      setStatus("up_to_date");
      setMessage("✅ Synced to Google Drive");
      alert("✅ Synced to Google Drive!");
    } catch (e) {
      log("uploadToDrive error:", e);
      setStatus("error");
      setMessage("Upload failed. See console.");
      alert("⚠️ Upload failed. Check console for details.");
    }
  };

  const restoreFromDrive = async () => {
    if (!isSignedIn) return alert("Please sign in first.");
    setStatus("restoring");
    setMessage("Restoring from Drive…");
    try {
      const file = backupFile || (await locateBackup());
      if (!file?.id) {
        setStatus("idle");
        setMessage("No backup found.");
        alert("No backup found on Drive yet.");
        return;
      }

      const dl = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const json = await dl.json();

      if (!json || typeof json !== "object") {
        throw new Error("Invalid JSON in Drive backup.");
      }
      if (typeof onRestore === "function") onRestore(json);
      setStatus("up_to_date");
      setMessage("✅ Restored from Drive");
      alert("✅ Restored from Google Drive.");
    } catch (e) {
      log("restoreFromDrive error:", e);
      setStatus("error");
      setMessage("Restore failed. See console.");
      alert("⚠️ Restore failed. See console for details.");
    }
  };

  const signIn = () => tokenClientRef.current?.requestAccessToken();
  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
    setBackupFile(null);
    setStatus("idle");
    setMessage("");
  };

  // ---- Local backup (works without sign-in) ----------------------------------

  const exportLocal = () => {
    const payload = JSON.stringify(dataToSync || {}, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = BACKUP_NAME;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImportLocal = async (evt) => {
    try {
      const file = evt.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || typeof json !== "object") throw new Error("Invalid JSON");
      if (typeof onRestore === "function") onRestore(json);
      setStatus("up_to_date");
      setMessage("✅ Restored from local file");
      alert("✅ Restored from local backup.");
      evt.target.value = ""; // reset
    } catch (e) {
      log("Local import error:", e);
      setStatus("error");
      setMessage("Local import failed. See console.");
      alert("⚠️ Local import failed. See console for details.");
    }
  };

  // ---- Init on mount ---------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureGoogleIdentityScript();
        await ensureGapiClient();
        if (cancelled) return;

        setGapiReady(true);
        setDriveReady(true);
        initTokenClient();

        if (accessToken) {
          // attempt to use existing token
          fetchUserProfile(accessToken);
        }
      } catch (e) {
        // If any Google script fails, local backup still works.
        log("GAPI/Identity init failed (local-only mode still works):", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auto-upload (debounced) when signed in --------------------------------
  useEffect(() => {
    if (!isSignedIn || !driveReady) return;
    const serialized = JSON.stringify(dataToSync || {});
    // Skip if empty object
    if (serialized === "{}") return;

    const t = setTimeout(() => {
      uploadToDrive().catch(() => {});
    }, 3000); // 3s debounce

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, driveReady, JSON.stringify(dataToSync || {})]);

  // ---- UI --------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Google Drive Sync */}
      <div className="rounded-xl border p-4">
        <h3 className="font-semibold text-green-700 mb-2">☁️ Google Drive Sync</h3>

        {!gapiReady || !driveReady ? (
          <p className="text-sm text-gray-500">
            Loading Google services… (Local backup available below)
          </p>
        ) : !isSignedIn ? (
          <button
            onClick={signIn}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              {user?.picture && (
                <img
                  src={user.picture}
                  alt="profile"
                  className="w-8 h-8 rounded-full"
                />
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
                disabled={status === "uploading"}
              >
                {status === "uploading" ? "Syncing…" : "Upload Backup"}
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

            {backupFile && (
              <p className="text-xs text-gray-500 mt-2">
                Found backup: <strong>{backupFile.name}</strong> • Last modified:{" "}
                {new Date(backupFile.modifiedTime).toLocaleString()}
              </p>
            )}
          </>
        )}

        {message && (
          <p
            className={`text-sm mt-2 ${
              status === "error"
                ? "text-red-600"
                : status === "up_to_date"
                ? "text-green-600"
                : "text-gray-600"
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {/* Local Backup (works on iPhone / Android / Desktop without sign-in) */}
      <div className="rounded-xl border p-4">
        <h3 className="font-semibold text-gray-800 mb-2 dark:text-gray-100">
          💾 Local Backup
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportLocal}
            className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
          >
            Export JSON
          </button>

          <label className="bg-white border px-3 py-2 rounded cursor-pointer hover:bg-gray-50">
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={onImportLocal}
              hidden
            />
          </label>

          <span className="text-xs text-gray-500">
            Tip: Use Export to save a copy. Use Import to restore on any device.
          </span>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Your entries are also saved in this browser’s storage so you won’t lose data
          if you’re offline or not signed in. For cross-device moves, use Export/Import
          or Google Drive.
        </p>
      </div>
    </div>
  );
}
