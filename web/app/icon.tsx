import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// mascote ambar (mesmo do app) sobre fundo escuro com leve brilho
const SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>" +
  "<rect x='9' y='3' width='2' height='4' fill='#f2c14e'/>" +
  "<rect x='21' y='3' width='2' height='4' fill='#f2c14e'/>" +
  "<rect x='5' y='7' width='22' height='18' rx='5' fill='#f2c14e'/>" +
  "<rect x='11' y='13' width='3' height='6' rx='1.2' fill='#1a1206'/>" +
  "<rect x='18' y='13' width='3' height='6' rx='1.2' fill='#1a1206'/>" +
  "</svg>";
const ROBOT = `data:image/svg+xml,${encodeURIComponent(SVG)}`;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 42%, #2a2008, #0a0a0a 70%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ROBOT} width={330} height={330} alt="" />
      </div>
    ),
    { ...size }
  );
}
