import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";

// --- Google Drive Credentials ---
const CLIENT_ID =
  "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | restoring | done | error

  useEffect(() => {
    const loadLibraries = async () => {
      try {
        await new Promise((resolve) => gapi.load("client", resolve));
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });

        const tc = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp?.access_token) {
              setAccessToken(resp.access_token);
              localStorage.setItem("gj_access_token", resp.access_token);
              fetchUserProfile(resp.access_token);
            } else {
              console.error("No token:", resp);
            }
          },
        });
        setTokenClient(tc);

        const saved = localStorage.getItem("gj_access_token");
        if (saved) {
          setAccessToken(saved);
          fetchUserProfile(saved);
        }
      } catch (err) {
        console.error("GAPI init failed:", err);
      }
    };

    if (!window.google?.accounts) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = loadLibraries;
      document.body.appendChild(script);
    } else {
      loadLibraries();
    }
  }, []);

  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await res.json();
      setUser(profile);
      // Try a gentle auto-restore
      autoRestoreFromDrive(token, false);
    } catch (err) {
      console.error("Profile fetch failed:", err);
    }
  };

  const signIn = () => tokenClient?.requestAccessToken();
  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
  };

  const findBackup = async () => {
    const res = await gapi.client.drive.files.list({
      q: "trashed = false and name = 'gratitude_journal_backup.json'",
      fields: "files(id, name, modifiedTime)",
      spaces: "drive",
    });
    return res.result.files?.[0] || null;
  };

  const uploadToDrive = async () => {
    if (!accessToken) return alert("Please sign in first.");
    setStatus("uploading");
    try {
      const content = JSON.stringify(dataToSync ?? {}, null, 2);
      const blob = new Blob([content], { type: "application/json" });

      const existing = await findBackup();
      const headers = { Authorization: `Bearer ${accessToken}` };

      if (existing) {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
          { method: "PATCH", headers, body: blob }
        );
      } else {
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
        await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          { method: "POST", headers, body: form }
        );
      }

      setStatus("done");
      alert("✅ Synced to Google Drive!");
    } catch (err) {
      console.error("Upload failed:", err);
      setStatus("error");
    }
  };

  // token: pass; noisyAlert: whether to show alert after restore
  const autoRestoreFromDrive = async (token, noisyAlert = true) => {
    try {
      setStatus("restoring");
      const file = await findBackup();
      if (!file) {
        setStatus("idle");
        if (noisyAlert) alert("No backup found on Drive yet.");
        return;
      }
      const dl = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await dl.json();
      if (json && typeof onRestore === "function") onRestore(json);
      setStatus("done");
      if (noisyAlert) alert("✅ Restored from Google Drive.");
    } catch (err) {
      console.error("Restore failed:", err);
      setStatus("error");
      if (noisyAlert) alert("⚠️ Restore failed. Try signing out/in and retry.");
    }
  };

  // Debounced auto-upload
  useEffect(() => {
    if (!accessToken || !dataToSync) return;
    const t = setTimeout(uploadToDrive, 3000);
    return () => clearTimeout(t);
  }, [JSON.stringify(dataToSync), accessToken]); // stringify for deep compare

  return (
    <div className="mt-6 text-center">
      <h3 className="font-semibold text-green-700 mb-2">☁️ Google Drive Sync</h3>

      {!accessToken ? (
        <button
          onClick={signIn}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            {user?.picture && (
              <img src={user.picture} alt="profile" className="w-8 h-8 rounded-full" />
            )}
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
              {status === "uploading" ? "Syncing…" : "Upload Backup"}
            </button>
            <button
              onClick={() => autoRestoreFromDrive(accessToken, true)}
              className="bg-white border border-gray-300 text-gray-800 px-3 py-2 rounded hover:bg-gray-50"
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

      {status === "restoring" && (
        <p className="text-sm text-gray-500 mt-2">🔄 Restoring from Drive…</p>
      )}
      {status === "done" && (
        <p className="text-sm text-green-600 mt-2">✅ Up to date</p>
      )}
    </div>
  );
}
