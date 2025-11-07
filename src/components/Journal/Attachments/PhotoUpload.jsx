export default function PhotoUpload({ photo, setPhoto }) {
  return (
    <div className="mt-2">
      <p className="text-sm font-medium mb-1">📸 Add Photo</p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPhoto(reader.result);
          reader.readAsDataURL(file);
        }}
      />
      {photo && (
        <div className="mt-2">
          <img src={photo} alt="preview" className="max-h-40 rounded-lg border" />
          <button
            onClick={() => setPhoto(null)}
            className="text-xs text-red-600 underline mt-1"
          >
            remove
          </button>
        </div>
      )}
    </div>
  );
}

