/**
 * The two big cats of the app in different poses. "stand" is the original
 * cut-out (kept in a private bucket, see .claude/docs/pulapki.md); the other
 * poses are freely licensed photos from Wikimedia Commons, credited below
 * and in public/animals/CREDITS.md.
 */
export const ANIMALS = {
  lion: {
    name: "Lew",
    emoji: "🦁",
    poses: {
      stand: "/avatars/lion-full.webp",
      walk: "/animals/lion-walk.webp",
      lie: "/animals/lion-lie.webp",
      peek: "/animals/lion-peek.webp",
      portrait: "/animals/lion-portrait.webp",
      roar: "/animals/lion-roar.webp",
      proud: "/animals/lion-stand.webp",
    },
  },
  puma: {
    name: "Puma",
    emoji: "🐆",
    poses: {
      stand: "/avatars/puma-full.webp",
      walk: "/animals/puma-walk.webp",
      lie: "/animals/puma-lie.webp",
      peek: "/animals/puma-peek.webp",
      portrait: "/animals/puma-portrait.webp",
      sit: "/animals/puma-sit.webp",
      lick: "/animals/puma-lick.webp",
    },
  },
} as const;

export type Species = keyof typeof ANIMALS;
export type Pose = "stand" | "walk" | "lie" | "peek" | "portrait";

/** A different pose greets you each day; the same one all day. */
const DAILY: Pose[] = ["stand", "walk", "portrait", "lie", "stand", "peek", "walk"];

export function poseOfTheDay(date: string): Pose {
  return DAILY[Number(date.slice(8, 10)) % DAILY.length];
}

/**
 * Where the Santa hat sits on the standing cut-outs, in percent of the image
 * itself; `ratio` is the image's width / height, so the hat follows the
 * picture and not the box it is fitted into.
 */
export const HAT_ON_STAND: Record<Species, { ratio: number; left: number; top: number; width: number; rotate: number }> = {
  lion: { ratio: 299 / 521, left: 12, top: -9, width: 46, rotate: -10 },
  puma: { ratio: 175 / 409, left: 14, top: -7, width: 60, rotate: -8 },
};

export const PHOTO_CREDITS = [
  { file: "lion-walk", title: "Asiatic lion 03.jpg", author: "Bernard Gagnon", licence: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Asiatic_lion_03.jpg" },
  { file: "lion-lie", title: "Lion (Panthera leo) male 6y.jpg", author: "Charles J. Sharp", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Lion_(Panthera_leo)_male_6y.jpg" },
  { file: "lion-peek", title: "Lion d'Afrique.jpg", author: "Clément Bardot", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Lion_d%27Afrique.jpg" },
  { file: "lion-portrait", title: "011 The lion king Tryggve in the Serengeti National Park Photo by Giles Laurent.jpg", author: "Giles Laurent", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:011_The_lion_king_Tryggve_in_the_Serengeti_National_Park_Photo_by_Giles_Laurent.jpg" },
  { file: "lion-roar", title: "Lion male.jpg", author: "Byrdyak", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Lion_male.jpg" },
  { file: "lion-stand", title: "Lion (Panthera leo) male Phinda.jpg", author: "Charles J. Sharp", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Lion_(Panthera_leo)_male_Phinda.jpg" },
  { file: "puma-walk", title: "Puma concolor stanleyana - Texas Park - Lanzarote -PC08.jpg", author: "Luis Miguel Bugallo Sánchez (Lmbuga)", licence: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Puma_concolor_stanleyana_-_Texas_Park_-_Lanzarote_-PC08.jpg" },
  { file: "puma-lie", title: "Cougar (7062752887).jpg", author: "Eric Kilby from Somerville, MA, USA", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Cougar_(7062752887).jpg" },
  { file: "puma-peek", title: "Serious Looking Cougar (6252154360).jpg", author: "Eric Kilby from Somerville, MA, USA", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Serious_Looking_Cougar_(6252154360).jpg" },
  { file: "puma-portrait", title: "Puma (Puma concolor concolor) female Leona Amarga 6.jpg", author: "Charles J. Sharp", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Puma_(Puma_concolor_concolor)_female_Leona_Amarga_6.jpg" },
  { file: "puma-sit", title: "Cougar (7143702079).jpg", author: "Jett Brooks from Tacoma, USA", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Cougar_(7143702079).jpg" },
  { file: "puma-lick", title: "Cougar Licking His Nose (17855168902).jpg", author: "Eric Kilby from Somerville, MA, USA", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Cougar_Licking_His_Nose_(17855168902).jpg" }
] as const;
