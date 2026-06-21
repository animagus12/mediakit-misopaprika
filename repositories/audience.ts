import audienceJson from "@/data/audience.json";

export interface AudienceGender {
  male: number;
  female: number;
  other: number;
}

export interface PlatformAudience {
  gender: AudienceGender;
  age: number[][];
  locations: (string | number)[][];
  peakTimes: string[];
}

export interface AudienceData {
  title: string;
  description: string;
  displayName: {
    instagram: string;
    youtube: string;
  };
  instagram: PlatformAudience;
  youtube: PlatformAudience;
}

export interface IAudienceRepository {
  get(): AudienceData;
}

class JsonAudienceRepository implements IAudienceRepository {
  get(): AudienceData {
    return audienceJson as AudienceData;
  }
}

export const audienceRepository: IAudienceRepository = new JsonAudienceRepository();
