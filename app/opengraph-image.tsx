import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Prop Drop — apartamente de vânzare din București";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoData = await readFile(join(process.cwd(), "app/icon.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#eceae6",
          padding: "48px",
        }}
      >
        <img src={logoSrc} width={160} height={160} alt="" />
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "#111111",
            marginTop: 28,
          }}
        >
          PROP DROP
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#6b6b6b",
            marginTop: 14,
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          Apartamente de vânzare din grupuri Facebook · București
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#3d7a7c",
            marginTop: 22,
            fontWeight: 600,
          }}
        >
          Filtre · Sortare · Favorite
        </div>
      </div>
    ),
    { ...size },
  );
}
