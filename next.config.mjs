/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "shikimori.one",
      },
      {
        protocol: "https",
        hostname: "shikimori.io",
      },
      {
        protocol: "https",
        hostname: "desu.shikimori.one",
      },
      {
        protocol: "https",
        hostname: "kawai.shikimori.one",
      },
      // ── YouTube превью ──
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default nextConfig;