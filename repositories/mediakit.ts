import mediakitJson from "@/data/mediakit.json";

export interface MediaKitHeader {
  wordmark: string;
  tagline: string;
  bio: string;
  followers: string;
  audience: string;
  location: string;
  handle: string;
  instagramUrl: string;
  phone: string;
  email: string;
  photo: string;
}

export interface MediaKitStats {
  monthlyViews: string;
  accountsReached: string;
  engagementRate: string;
  avgReelViews: string;
  caption: string;
}

export interface MediaKitServiceInput {
  name: string;
  price: string;
}

export interface MediaKitLogo {
  src: string;
  url: string;
}

export interface MediaKitCollabs {
  subline: string;
  logos: MediaKitLogo[];
}

export interface MediaKitTileStats {
  views: string;
  likes: string;
  comments: string;
  saves: string;
  shares: string;
}

export interface MediaKitTileInput {
  img: string;
  pos: string;
  url: string;
  stats: MediaKitTileStats;
}

export interface MediaKitData {
  brandHandle: string;
  header: MediaKitHeader;
  stats: MediaKitStats;
  services: [MediaKitServiceInput, MediaKitServiceInput, MediaKitServiceInput];
  startsAtNote: string;
  addons: [MediaKitServiceInput, MediaKitServiceInput];
  bookingTerms: string;
  collabs: MediaKitCollabs;
  tiles: [MediaKitTileInput, MediaKitTileInput, MediaKitTileInput];
}

export interface IMediaKitRepository {
  get(): MediaKitData;
}

class JsonMediaKitRepository implements IMediaKitRepository {
  get(): MediaKitData {
    return mediakitJson as MediaKitData;
  }
}

export const mediakitRepository: IMediaKitRepository = new JsonMediaKitRepository();
