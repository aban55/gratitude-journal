import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";     // 🔸 Insert your API key here
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | restoring | done | error

  // --- Load gapi + GIS ---
  useEffect(() => {
    const loadLibraries = async () => {
      await new Promise((resolve) => gapi.load("client", resolve));
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      });

      // Initialize the Google Identity Services token client
      const tc = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response && response.access_token) {
            setAccessToken(response.access_token);
            localStorage.setItem("gj_access_token", response.access_token);
            fetchUserProfile(response.access_token);
          } else {
            console.error("No access token received:", response);
          }
        },
      });
      setTokenClient(tc);

      // Restore previous session if token exists
      const savedToken = localStorage.getItem("gj_access_token");
      if (savedToken) {
        setAccessToken(savedToken);
        fetchUserProfile(savedToken);
      }
    };

    // Load GIS script dynamically if not already
    if (!window.google?.accounts) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
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
      autoRestoreFromDrive(token);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  };

  const signIn = () => {
    if (tokenClient) tokenClient.requestAccessToken();
  };

  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
  };

  // ---- Upload backup ----
  const uploadToDrive = async () => {
    if (!accessToken) return alert("Please sign in first.");
    setStatus("uploading");
    try {
      const content = JSON.stringify(dataToSync, null, 2);
      const blob = new Blob([content], { type: "application/json" });

      // Check if file already exists
      const searchResponse = await gapi.client.drive.files.list({
        q: "name='gratitude_journal_backup.json'",
        fields: "files(id, name)",
      });

      let fileId = searchResponse.result.files?.[0]?.id;
      const headers = { Authorization: `Bearer ${accessToken}` };

      if (fileId) {
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: "PATCH",
          headers,
          body: blob,
        });
      } else {
        const metadata = {
          name: "gratitude_journal_backup.json",
          mimeType: "application/json",
        };
        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        form.append("file", blob);
        await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers,
          body: form,
        });
      }
      setStatus("done");
      alert("✅ Synced successfully to Google Drive!");
    } catch (err) {
      console.error("Upload failed:", err);
      setStatus("error");
    }
  };

  // ---- Auto-restore from Drive ----
  const autoRestoreFromDrive = async (token) => {
    try {
      setStatus("restoring");
      const res = await gapi.client.drive.files.list({
        q: "name='gratitude_journal_backup.json'",
        fields: "files(id, name)",
      });
      const file = res.result.files?.[0];
      if (!file) return setStatus("idle");

      const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await dl.json();
      if (onRestore && json) onRestore(json);
      setStatus("done");
    } catch (err) {
      console.error("Restore failed:", err);
      setStatus("error");
    }
  };

  return (
    <div className="mt-6 text-center">
      <h3 className="font-semibold text-green-700 mb-2">☁️ Google Drive Sync</h3>

      {!accessToken ? (
        <button
          onClick={signIn}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          Sign in with Google Drive
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            {user?.picture && <img src={user.picture} alt="profile" className="w-8 h-8 rounded-full" />}
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

      {status === "restoring" && <p className="text-sm text-gray-500 mt-2">🔄 Restoring from Drive...</p>}
      {status === "done" && <p className="text-sm text-green-600 mt-2">✅ Up to date</p>}
    </div>
  );
}
