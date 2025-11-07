import { useEffect } from "react";

export default function SketchPad({ sketch, setSketch }) {
  useEffect(() => {
    const c = document.getElementById("sketchCanvas");
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#a16207";
    let drawing = false;

    const start = (e) => {
      drawing = true;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    };
    const draw = (e) => {
      if (!drawing) return;
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    };
    const stop = () => (drawing = false);

    c.addEventListener("mousedown", start);
    c.addEventListener("mousemove", draw);
    c.addEventListener("mouseup", stop);
    c.addEventListener("mouseout", stop);
    return () => {
      c.removeEventListener("mousedown", start);
      c.removeEventListener("mousemove", draw);
      c.removeEventListener("mouseup", stop);
      c.removeEventListener("mouseout", stop);
    };
  }, []);

  return (
    <div className="mt-3">
      <p className="text-sm font-medium mb-1">✏️ Quick Sketch</p>
      <canvas
        id="sketchCanvas"
        width="320"
        height="160"
        className="border border-amber-200 rounded-lg bg-white"
      ></canvas>
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => {
            const c = document.getElementById("sketchCanvas");
            const ctx = c.getContext("2d");
            ctx.clearRect(0, 0, c.width, c.height);
            setSketch(null);
          }}
          className="text-xs px-2 py-1 border rounded-md border-amber-200 text-amber-800"
        >
          Clear
        </button>
        <button
          onClick={() => {
            const c = document.getElementById("sketchCanvas");
            const img = c.toDataURL("image/png");
            setSketch(img);
          }}
          className="text-xs px-2 py-1 border rounded-md border-amber-200 text-amber-800"
        >
          Save Sketch
        </button>
      </div>
    </div>
  );
}

