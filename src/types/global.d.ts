export {};

declare global {
  interface Window {
    kbox: KinoBoxInitializer;
  }
}

type KinoBoxPlayerName = "alloha" | "kodik" | "collaps";

interface KinoBoxPlayerOptions {
  enable: boolean;
  position: number;
}

interface KinoBoxOptions {
  search: {
    shikimori: string;
  };
  players: Record<KinoBoxPlayerName, KinoBoxPlayerOptions>;
}

type KinoBoxInitializer = (
  container: string | HTMLElement,
  options: KinoBoxOptions,
) => void;
