import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RAM Dosya Atama Sistemi",
    short_name: "RAM Atama",
    description: "Rehberlik Araştırma Merkezi - Yük Dengelemeli Dosya Atama Sistemi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0d9488",
    categories: ["education", "productivity", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: "Yeni Dosya Ata",
        short_name: "Ata",
        description: "Hızlıca yeni dosya ata",
        url: "/?action=assign",
        icons: [{ src: "/icon.svg", sizes: "96x96" }],
      },
      {
        name: "Raporlar",
        short_name: "Rapor",
        description: "Günlük ve aylık raporları görüntüle",
        url: "/?tab=reports",
        icons: [{ src: "/icon.svg", sizes: "96x96" }],
      },
    ],
    lang: "tr",
    dir: "ltr",
    prefer_related_applications: false,
  };
}
