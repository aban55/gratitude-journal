import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";
import toast, { Toaster } from "react-hot-toast";

const CLIENT_ID =
  "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc"; // ← Replace with your key
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");

  // ------------------------------
  // INIT GOOGLE API + TOKEN CLIENT
  // ------------------------------
  useEffect(() => {
    const loadLibs = async () => {
      await new Promise((res) => gapi.load("client", res));
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [
          "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
        ],
      });

      const tc = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (res) => {
          if (res.access_token) {
            setAccessToken(res.access_token);
            localStorage.setItem("gj_access_token", res.access_token);
            fetchUserProfile(res.access_token);
          }
        },
      });
      setTokenClient(tc);

      const saved = localStorage.getItem("gj_access_token");
      if (saved) {
        setAccessToken(saved);
        fetchUserProfile(saved);
      }
    };

    if (!window.google?.accounts) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.onload = loadLibs;
      document.body.appendChild(s);
    } else {
      loadLibs();
    }
  }, []);

  // ------------------------------
  // FETCH USER PROFILE
  // ------------------------------
  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await res.json();
      setUser(profile);
      autoRestore(token);
    } catch (err) {
      console.error("Profile error:", err);
    }
  };

  // ------------------------------
  // SIGN IN / OUT
  // ------------------------------
  const signIn = () => tokenClient?.requestAccessToken({ prompt: "consent" });
  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
    toast("Signed out", { icon: "👋" });
  };

  // ------------------------------
  // AUTO TOKEN REFRESH (every 30 min)
  // ------------------------------
  useEffect(() => {
    if (!tokenClient) return;
    const check = async () => {
      const saved = localStorage.getItem("gj_access_token");
      if (!saved) return;
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${saved}` },
      });
      if (r.status === 401) {
        console.log("🔄 refreshing token silently");
        tokenClient.requestAccessToken({ prompt: "" });
      }
    };
    const i = setInterval(check, 1000 * 60 * 30);
    return () => clearInterval(i);
  }, [tokenClient]);

  // ------------------------------
  // UPLOAD TO GOOGLE DRIVE
  // ------------------------------
  const uploadToDrive = async () => {
    if (!accessToken) return toast.error("Please sign in first");
    setStatus("uploading");
    try {
      const blob = new Blob([JSON.stringify(dataToSync, null, 2)], {
        type: "application/json",
      });

      const search = await gapi.client.drive.files.list({
        q: "name='gratitude_journal_backup.json'",
        fields: "files(id, name)",
      });
      const fileId = search.result.files?.[0]?.id;
      const headers = { Authorization: `Bearer ${accessToken}` };

      if (fileId) {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          { method: "PATCH", headers, body: blob }
        );
      } else {
        const meta = {
          name: "gratitude_journal_backup.json",
          mimeType: "application/json",
        };
        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
        form.append("file", blob);
        await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers,
          body: form,
        });
      }
      setStatus("done");
      toast.success("✅ Synced successfully to Google Drive!");
    } catch (err) {
      console.error(err);
      setStatus("error");
      toast.error("Upload failed");
    }
  };

  // ------------------------------
  // AUTO RESTORE
  // ------------------------------
  const autoRestore = async (token) => {
    try {
      setStatus("restoring");
      const res = await gapi.client.drive.files.list({
        q: "name='gratitude_journal_backup.json'",
        fields: "files(id, name)",
      });
      const file = res.result.files?.[0];
      if (!file) return setStatus("idle");

      const dl = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await dl.json();
      if (onRestore && json) onRestore(json);
      toast.success("☁️ Auto-restored from Google Drive!");
      setStatus("done");
    } catch (err) {
      console.error("Restore failed:", err);
      setStatus("error");
    }
  };

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="mt-6 text-center">
      <Toaster position="bottom-center" />
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
            {user?.picture ? (
              <img src={user.picture} alt="profile" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
                {user?.name?.[0] || "?"}
              </div>
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
