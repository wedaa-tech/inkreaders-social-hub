// app/create/pack/types.ts
export type SectionKind = 'headlines' | 'vocab' | 'quiz' | 'explanation' | 'freeform';

export type Section = {
  id: string;
  title: string;
  body: string;     // markdown / plain text
  kind?: SectionKind;
  editable?: boolean;
};

export type Pack = {
  id?: string;
  title: string;
  focus?: string;
  range?: 'weekly' | 'monthly';
  tags: string[];
  visibility?: 'public' | 'private';
  sections: Section[];
  created_at?: string;
  origin?: { user?: string; pack_id?: string } | null;
};
