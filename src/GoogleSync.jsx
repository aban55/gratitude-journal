import React, { useEffect, useRef, useState } from "react";

const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_NAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [status, setStatus] = useState("Offline");
  const [lastRestored, setLastRestored] = useState(
    localStorage.getItem("gj_last_restored") || null
  );

  const tokenClientRef = useRef(null);

  // --- Load Google API ---
  useEffect(() => {
    const load = () => {
      /* global google, gapi */
      if (!window.google || !window.gapi) return;
      gapi.load("client", async () => {
        await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] });
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt: "",
          callback: async (resp) => {
            if (resp.error) return console.error(resp);
            setAccessToken(resp.access_token);
            localStorage.setItem("gj_access_token", resp.access_token);
            await fetchUser(resp.access_token);
          },
        });

        // try restore silently if token cached
        const cached = localStorage.getItem("gj_access_token");
        if (cached) {
          setAccessToken(cached);
          fetchUser(cached);
        } else {
          // silent sign-in if permission already granted
          tokenClientRef.current.requestAccessToken({ prompt: "" });
        }
      });
    };
    if (!window.gapi) {
      const s = document.createElement("script");
      s.src = "https://apis.google.com/js/api.js";
      s.onload = load;
      document.body.appendChild(s);
    } else load();
  }, []);

  // --- Fetch profile ---
  const fetchUser = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = await res.json();
      setUser(u);
      console.log("[GoogleSync] Signed in:", u);
      setStatus("Online");
    } catch (e) {
      console.warn("[GoogleSync] User fetch failed", e);
      setStatus("Offline");
    }
  };

  // --- Locate or create backup file in appDataFolder ---
  const locateBackup = async () => {
    try {
      const res = await gapi.client.drive.files.list({
        q: `name='${BACKUP_NAME}' and trashed=false`,
        spaces: "appDataFolder",
        corpora: "appDataFolder",
        fields: "files(id, name, modifiedTime)",
      });
      return res.result.files[0];
    } catch (e) {
      console.error("[GoogleSync] locateBackup error:", e);
      throw e;
    }
  };

  // --- Upload backup ---
  const uploadBackup = async () => {
    try {
      setStatus("Uploading...");
      const json = JSON.stringify(dataToSync);
      const blob = new Blob([json], { type: "application/json" });
      const file = await locateBackup();

      if (file) {
        // Update existing file
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: blob,
          }
        );
      } else {
        // Create new file in appDataFolder
        const meta = {
          name: BACKUP_NAME,
          mimeType: "application/json",
          parents: ["appDataFolder"],
        };
        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(meta)], { type: "application/json" })
        );
        form.append("file", blob);
        await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
          }
        );
      }

      setStatus("✅ Synced to Drive");
      localStorage.setItem("gj_last_sync", new Date().toISOString());
    } catch (e) {
      console.error("[GoogleSync] uploadBackup error:", e);
      setStatus("⚠️ Error syncing, using local backup.");
    }
  };

  // --- Restore backup ---
  const restoreBackup = async () => {
    try {
      setStatus("Restoring...");
      const file = await locateBackup();
      if (!file) return alert("No backup found in Drive.");
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const json = await res.json();
      onRestore(json);
      const ts = new Date().toLocaleString();
      setLastRestored(ts);
      localStorage.setItem("gj_last_restored", ts);
      setStatus("✅ Restored from Drive");
    } catch (e) {
      console.error("[GoogleSync] restoreBackup error:", e);
      setStatus("⚠️ Error restoring from Drive");
    }
  };

  // --- Sign out ---
  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
    setStatus("Signed out");
  };

  // --- Auto backup every 3 minutes when online ---
  useEffect(() => {
    if (!accessToken || !dataToSync) return;
    const t = setInterval(uploadBackup, 180000);
    return () => clearInterval(t);
  }, [accessToken, dataToSync]);

  return (
    <div className="mt-6 text-sm text-center">
      <div
        className={`p-3 rounded-lg border ${
          status.startsWith("✅")
            ? "bg-green-50 border-green-300 text-green-700"
            : status.startsWith("⚠️")
            ? "bg-red-50 border-red-300 text-red-700"
            : "bg-gray-50 border-gray-200 text-gray-700"
        }`}
      >
        <p>{status}</p>
        {lastRestored && (
          <p className="text-xs text-gray-500 mt-1">
            Last restored: {lastRestored}
          </p>
        )}
      </div>

      {user ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-center gap-3">
            <img
              src={user.picture}
              alt="avatar"
              className="w-8 h-8 rounded-full"
            />
            <div className="text-left">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-3">
            <button
              onClick={uploadBackup}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              Upload Backup
            </button>
            <button
              onClick={restoreBackup}
              className="bg-blue-600 text-white px-3 py-1 rounded"
            >
              Restore from Drive
            </button>
            <button
              onClick={signOut}
              className="bg-gray-400 text-white px-3 py-1 rounded"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() =>
            tokenClientRef.current?.requestAccessToken({ prompt: "consent" })
          }
        >
          Sign in with Google
        </button>
      )}
    </div>
  );
}
