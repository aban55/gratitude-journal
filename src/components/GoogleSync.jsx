/* GoogleSync.jsx */
import { useEffect } from "react";

export default function GoogleSync({ dataToSync, onRestore }) {
  const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
  const SCOPES =
    "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile";

  useEffect(() => {
    /* global google */
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = init;
    document.body.appendChild(script);

    function init() {
      if (!window.google) return;
      window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (!tokenResponse?.access_token) return;
          syncToDrive(tokenResponse.access_token);
        },
      });
    }
  }, []);

  async function syncToDrive(token) {
    try {
      const fileName = "GratitudeJournal.json";
      const fileData = JSON.stringify(dataToSync);
      const metadata = {
        name: fileName,
        mimeType: "application/json",
      };

      const boundary = "----boundary";
      const body =
        `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        "Content-Type: application/json\r\n\r\n" +
        fileData +
        `\r\n--${boundary}--`;

      await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      });

      console.log("✅ Synced to Google Drive");
    } catch (err) {
      console.error("Drive sync error:", err);
    }
  }

  return null;
}
