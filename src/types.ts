export interface Bookmark {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  tweetUrl: string;
  dateBookmarked: string;
  createdAt: string;
  media?: Array<{ type: string; url: string }>;
  mediaType: 'photo' | 'video' | 'thread' | 'post';
  hashtags?: string[];
  mentions?: string[];
  categoryId?: string | null;
  tagIds?: string[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  accent: string;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}
