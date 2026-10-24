export type PrestudySentence = {
  text: string;
  structure: string;
  translation: string;
  chunks?: string[];
};

export type PrestudyWord = {
  word: string;
  phonetic?: string;
  pos?: string;
  meaning: string;
  example?: string;
};

export type PrestudyPayload = {
  version: 1;
  generatedAt: string;
  source: 'llm' | 'offline';
  model?: string;
  summary: string;
  sentences: PrestudySentence[];
  words: PrestudyWord[];
};

export type ApiError = { error: string };
