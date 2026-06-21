import heroJson from "@/data/hero.json";

export interface HeroImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface HeroData {
  title: string;
  subtitle: string;
  description: string;
  buttonText: string;
  image: HeroImage;
}

export interface IHeroRepository {
  get(): HeroData;
}

class JsonHeroRepository implements IHeroRepository {
  get(): HeroData {
    return heroJson;
  }
}

export const heroRepository: IHeroRepository = new JsonHeroRepository();
