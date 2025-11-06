import React, { useEffect, useRef, useState } from "react";

/**
 * GoogleSync.jsx (NON-DEPRECATING ENHANCE)
 * - Keeps your existing Drive flow & scope
 * - Auto-restore on startup: local -> Drive
 * - Silent reauth on reload (prompt:'') + hourly refresh
 * - Saves a local JSON backup after each successful upload
 * - Minimal, helpful console logs (no spam)
 */

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
/** ⬇️ Keep scope as-is (do not change; your current setup works with drive.file) */
const SCOPES   = "https://www.googleapis.com/auth/drive.file";
const BACKUP_NAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem("gj_access_token") || null);
  const [user, setUser]               = useState(null);
  const [status, setStatus]           = useState("idle"); // idle | syncing | up_to_date | restoring | error | offline
  const [lastSynced, setLastSynced]   = useState(localStorage.getItem("gj_last_synced") || null);
  const [lastRestored, setLastRestored] = useState(localStorage.getItem("gj_last_restored") || null);

  const tokenClientRef = useRef(null);
  const backupFileIdRef = useRef(null); // cache file id once found

  // ---------------- Load Google scripts & init ----------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Load Google Identity Services
        if (!window.google?.accounts) {
          await new Promise((resolve) => {
            const s = document.createElement("script");
            s.src = "https://accounts.google.com/gsi/client";
            s.async = true;
            s.onload = resolve;
            document.body.appendChild(s);
          });
        }

        // Load GAPI client
        if (!window.gapi?.client) {
          await new Promise((resolve) => {
            const s = document.createElement("script");
            s.src = "https://apis.google.com/js/api.js";
            s.async = true;
            s.onload = async () => {
              await window.gapi.load("client", async () => {
                await window.gapi.client.init({
                  apiKey: API_KEY,
                  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
                });
                resolve();
              });
            };
            document.body.appendChild(s);
          });
        }

        if (cancelled) return;

        // Init OAuth token client
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt: "", // silent reauth if user already granted
          callback: async (resp) => {
            if (resp?.access_token) {
              localStorage.setItem("gj_access_token", resp.access_token);
              setAccessToken(resp.access_token);
              await fetchUserProfile(resp.access_token);
            }
          },
        });

        // 1) Try local restore immediately (always safe)
        tryLocalRestore();

        // 2) If we already have a token, use it; else attempt silent fetch
        if (accessToken) {
          await fetchUserProfile(accessToken);
        } else {
          tokenClientRef.current.requestAccessToken({ prompt: "" });
        }
      } catch (e) {
        console.warn("[GoogleSync] Init error:", e);
        setStatus("offline");
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh token every ~55 minutes to avoid expiry mid-session
  useEffect(() => {
    if (!tokenClientRef.current || !accessToken) return;
    const t = setInterval(() => {
      tokenClientRef.current.requestAccessToken({ prompt: "" });
    }, 55 * 60 * 1000);
    return () => clearInterval(t);
  }, [accessToken]);

  // ---------------- Local restore (first priority) ----------------
  const tryLocalRestore = () => {
    try {
      const localBackup = localStorage.getItem("gratitude_local_backup");
      if (localBackup && onRestore) {
        const parsed = JSON.parse(localBackup);
        if (parsed && typeof parsed === "object") {
          onRestore(parsed);
          const ts = new Date().toISOString();
          localStorage.setItem("gj_last_restored", ts);
          setLastRestored(ts);
          // Don't log noisily; just a single helpful line
          console.log("📁 [GoogleSync] Restored from local backup.");
        }
      }
    } catch {
      // ignore malformed local JSON silently
    }
  };

  // ---------------- Profile & auto-restore from Drive ----------------
  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = await res.json();
      if (!u?.email) throw new Error("No user");
      setUser(u);
      console.log("[GoogleSync] Signed in as:", u.email);

      // Try auto-restore from Drive if no local backup was found/applied
      if (!lastRestored) {
        await restoreFromDriveInternal(token);
      }
    } catch (e) {
      console.warn("[GoogleSync] Profile fetch failed:", e);
      setUser(null);
      setStatus("offline");
    }
  };

  // ---------------- Drive helpers ----------------
  const locateBackup = async () => {
    if (backupFileIdRef.current) {
      return backupFileIdRef.current;
    }
    try {
      const res = await window.gapi.client.drive.files.list({
        q: `name='${BACKUP_NAME}' and trashed=false`,
        fields: "files(id,name,modifiedTime)",
        spaces: "drive",
        corpora: "user",
      });
      const file = res.result?.files?.[0];
      if (file?.id) {
        backupFileIdRef.current = file.id;
        return file.id;
      }
      return null;
    } catch (e) {
      console.warn("[GoogleSync] locateBackup error:", e);
      return null;
    }
  };

  const restoreFromDriveInternal = async (token) => {
    try {
      setStatus("restoring");
      const fileId = await locateBackup();
      if (!fileId) {
        setStatus("idle");
        return;
      }
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (json && onRestore) {
        onRestore(json);
        // also persist to local for offline safety
        const payload = JSON.stringify(json);
        localStorage.setItem("gratitude_local_backup", payload);
        const ts = new Date().toISOString();
        localStorage.setItem("gj_last_restored", ts);
        setLastRestored(ts);
        console.log("☁️ [GoogleSync] Restored from Drive.");
      }
      setStatus("up_to_date");
    } catch (e) {
      console.warn("[GoogleSync] Drive restore failed:", e);
      setStatus("error");
    }
  };

  const uploadToDrive = async () => {
    if (!accessToken) return;
    try {
      setStatus("syncing");
      const payload = JSON.stringify(dataToSync ?? {}, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const headers = { Authorization: `Bearer ${accessToken}` };

      let fileId = await locateBackup();

      if (fileId) {
        // Update existing file contents
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          { method: "PATCH", headers, body: blob }
        );
      } else {
        // Create new file
        const metadata = { name: BACKUP_NAME, mimeType: "application/json" };
        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(metadata)], { type: "application/json" })
        );
        form.append("file", blob);

        const createRes = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          { method: "POST", headers, body: form }
        );
        const created = await createRes.json().catch(() => ({}));
        if (created?.id) backupFileIdRef.current = created.id;
      }

      // Write a local safety copy after successful upload
      localStorage.setItem("gratitude_local_backup", payload);
      const ts = new Date().toISOString();
      localStorage.setItem("gj_last_synced", ts);
      setLastSynced(ts);

      setStatus("up_to_date");
      // keep console calm; one helpful log:
      console.log("✅ [GoogleSync] Synced to Drive.");
    } catch (e) {
      console.warn("[GoogleSync] Upload failed:", e);
      setStatus("error");
    }
  };

  const restoreFromDrive = () => {
    if (!accessToken) return;
    restoreFromDriveInternal(accessToken);
  };

  // ---------------- Sign-in/out ----------------
  const signIn = () =>
    tokenClientRef.current?.requestAccessToken({ prompt: "consent" });

  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
    setStatus("offline");
  };

  // ---------------- Auto-upload debounce on data change ----------------
  useEffect(() => {
    if (!accessToken) return;
    const t = setTimeout(() => {
      if (dataToSync) uploadToDrive();
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dataToSync), accessToken]);

  // ---------------- UI ----------------
  return (
    <div className="space-y-3">
      <div
        className={`p-3 rounded-lg border text-sm text-center ${
          status === "up_to_date"
            ? "bg-green-50 border-green-300 text-green-700"
            : status === "syncing" || status === "restoring"
            ? "bg-yellow-50 border-yellow-300 text-yellow-800"
            : status === "error"
            ? "bg-red-50 border-red-300 text-red-700"
            : status === "offline"
            ? "bg-gray-100 border-gray-300 text-gray-600"
            : "bg-gray-50 border-gray-200 text-gray-700"
        }`}
      >
        <div>
          {status === "idle" && "☁️ Drive sync ready"}
          {status === "syncing" && "🔄 Syncing with Drive…"}
          {status === "restoring" && "🔄 Restoring from Drive…"}
          {status === "up_to_date" && "✅ Synced"}
          {status === "error" && "⚠️ Sync error — using local data"}
          {status === "offline" && "⚠️ Not signed in — local only"}
        </div>
        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
          {lastSynced && (
            <div>Last synced: {new Date(lastSynced).toLocaleString()}</div>
          )}
          {lastRestored && (
            <div>Last restored: {new Date(lastRestored).toLocaleString()}</div>
          )}
        </div>
      </div>

      {!accessToken ? (
        <button
          onClick={signIn}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-3">
            {user?.picture && (
              <img src={user.picture} alt="pfp" className="w-8 h-8 rounded-full" />
            )}
            <div className="text-left text-sm">
              <div className="font-medium">{user?.name}</div>
              <div className="text-gray-500">{user?.email}</div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
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
        </div>
      )}
    </div>
  );
}
