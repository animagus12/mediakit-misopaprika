import videosJson from "@/data/videos.json";

export interface Video {
  title: string;
  url: string;
  duration: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  color: string;
}

export interface VideoSection {
  platform: string;
  icon: string;
  videos: Video[];
}

export interface VideosData {
  title: string;
  description: string;
  sections: VideoSection[];
}

export interface IVideosRepository {
  get(): VideosData;
}

class JsonVideosRepository implements IVideosRepository {
  get(): VideosData {
    return videosJson;
  }
}

export const videosRepository: IVideosRepository = new JsonVideosRepository();
