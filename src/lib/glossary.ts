/**
 * Offline fallback dictionary. Only used when no LLM is configured / reachable,
 * so that the whole flow (pre-study -> reading -> translate) still works offline.
 * Extend `GLOSSARY` to improve offline coverage.
 */
export type GlossEntry = { pos: string; zh: string };

export const GLOSSARY: Record<string, GlossEntry> = {
  ubiquitous: { pos: 'adj.', zh: '无处不在的，普遍存在的' },
  inevitable: { pos: 'adj.', zh: '不可避免的，必然发生的' },
  meticulous: { pos: 'adj.', zh: '一丝不苟的，极其细心的' },
  reluctant: { pos: 'adj.', zh: '不情愿的，勉强的' },
  ambiguous: { pos: 'adj.', zh: '模棱两可的，含糊不清的' },
  arbitrary: { pos: 'adj.', zh: '任意的，武断的' },
  coherent: { pos: 'adj.', zh: '连贯的，条理清楚的' },
  compelling: { pos: 'adj.', zh: '令人信服的；引人入胜的' },
  comprehensive: { pos: 'adj.', zh: '全面的，综合的' },
  controversial: { pos: 'adj.', zh: '有争议的' },
  credible: { pos: 'adj.', zh: '可信的，可靠的' },
  crucial: { pos: 'adj.', zh: '至关重要的' },
  cumulative: { pos: 'adj.', zh: '累积的' },
  deliberate: { pos: 'adj.', zh: '故意的；深思熟虑的' },
  diminish: { pos: 'v.', zh: '减少，削弱' },
  discern: { pos: 'v.', zh: '辨认，察觉' },
  diverse: { pos: 'adj.', zh: '多种多样的' },
  elaborate: { pos: 'adj./v.', zh: '精心制作的；详细阐述' },
  eloquent: { pos: 'adj.', zh: '雄辩的，有说服力的' },
  empirical: { pos: 'adj.', zh: '实证的，经验主义的' },
  enhance: { pos: 'v.', zh: '增强，提高' },
  entail: { pos: 'v.', zh: '需要，必然涉及' },
  ephemeral: { pos: 'adj.', zh: '短暂的，转瞬即逝的' },
  explicit: { pos: 'adj.', zh: '明确的，直言的' },
  exploit: { pos: 'v.', zh: '利用；剥削' },
  facilitate: { pos: 'v.', zh: '促进，使便利' },
  feasible: { pos: 'adj.', zh: '可行的' },
  fluctuate: { pos: 'v.', zh: '波动，起伏' },
  fundamental: { pos: 'adj.', zh: '根本的，基础的' },
  gauge: { pos: 'v./n.', zh: '衡量，估计；计量器' },
  hypothesis: { pos: 'n.', zh: '假设，假说' },
  imperative: { pos: 'adj./n.', zh: '迫切的；必要之事' },
  implicit: { pos: 'adj.', zh: '含蓄的，隐含的' },
  incentive: { pos: 'n.', zh: '激励，动力' },
  infer: { pos: 'v.', zh: '推断，推论' },
  inherent: { pos: 'adj.', zh: '固有的，内在的' },
  inhibit: { pos: 'v.', zh: '抑制，阻碍' },
  initiate: { pos: 'v.', zh: '发起，开始' },
  innovative: { pos: 'adj.', zh: '创新的' },
  integrate: { pos: 'v.', zh: '整合，使一体化' },
  intricate: { pos: 'adj.', zh: '错综复杂的' },
  intrinsic: { pos: 'adj.', zh: '内在的，本质的' },
  justify: { pos: 'v.', zh: '证明…正当，为…辩护' },
  legitimate: { pos: 'adj.', zh: '合法的，正当的' },
  magnitude: { pos: 'n.', zh: '重要性；量级' },
  manipulate: { pos: 'v.', zh: '操纵，控制' },
  marginal: { pos: 'adj.', zh: '边缘的，微小的' },
  mitigate: { pos: 'v.', zh: '减轻，缓和' },
  negligible: { pos: 'adj.', zh: '微不足道的' },
  nuance: { pos: 'n.', zh: '细微差别' },
  obsolete: { pos: 'adj.', zh: '过时的，废弃的' },
  paradox: { pos: 'n.', zh: '悖论，自相矛盾的事' },
  perceive: { pos: 'v.', zh: '察觉，认为' },
  persistent: { pos: 'adj.', zh: '持续的，坚持不懈的' },
  plausible: { pos: 'adj.', zh: '貌似合理的' },
  pragmatic: { pos: 'adj.', zh: '务实的' },
  precedent: { pos: 'n.', zh: '先例' },
  predominant: { pos: 'adj.', zh: '占主导地位的' },
  preliminary: { pos: 'adj.', zh: '初步的，预备的' },
  profound: { pos: 'adj.', zh: '深刻的，深远的' },
  prominent: { pos: 'adj.', zh: '突出的，显著的' },
  prospect: { pos: 'n.', zh: '前景，可能性' },
  provoke: { pos: 'v.', zh: '激起，引发' },
  radical: { pos: 'adj.', zh: '激进的，根本的' },
  redundant: { pos: 'adj.', zh: '多余的，冗余的' },
  relevant: { pos: 'adj.', zh: '相关的，切题的' },
  resilient: { pos: 'adj.', zh: '有韧性的，能迅速恢复的' },
  rigorous: { pos: 'adj.', zh: '严格的，严谨的' },
  robust: { pos: 'adj.', zh: '强健的，稳健的' },
  scrutiny: { pos: 'n.', zh: '仔细审查' },
  skeptical: { pos: 'adj.', zh: '怀疑的' },
  subtle: { pos: 'adj.', zh: '微妙的，不易察觉的' },
  substantial: { pos: 'adj.', zh: '大量的，实质的' },
  sustain: { pos: 'v.', zh: '维持，支撑' },
  tangible: { pos: 'adj.', zh: '有形的，确凿的' },
  tedious: { pos: 'adj.', zh: '冗长乏味的' },
  tentative: { pos: 'adj.', zh: '试探性的，暂定的' },
  threshold: { pos: 'n.', zh: '门槛，临界点' },
  tolerate: { pos: 'v.', zh: '容忍，忍受' },
  transcend: { pos: 'v.', zh: '超越' },
  trivial: { pos: 'adj.', zh: '琐碎的，不重要的' },
  undermine: { pos: 'v.', zh: '削弱，暗中破坏' },
  underlying: { pos: 'adj.', zh: '潜在的，根本的' },
  unprecedented: { pos: 'adj.', zh: '史无前例的' },
  viable: { pos: 'adj.', zh: '可行的，能存活的' },
  vivid: { pos: 'adj.', zh: '生动的，鲜明的' },
  vulnerable: { pos: 'adj.', zh: '脆弱的，易受伤害的' },
  widespread: { pos: 'adj.', zh: '广泛的' },
  melancholy: { pos: 'n./adj.', zh: '忧郁，悲伤' },
  nostalgia: { pos: 'n.', zh: '怀旧，乡愁' },
  solitude: { pos: 'n.', zh: '独处，孤独' },
  gratitude: { pos: 'n.', zh: '感激，感恩' },
  resentment: { pos: 'n.', zh: '怨恨，不满' },
  compassion: { pos: 'n.', zh: '同情，怜悯' },
  dignity: { pos: 'n.', zh: '尊严' },
  despair: { pos: 'n.', zh: '绝望' },
  ambition: { pos: 'n.', zh: '雄心，抱负' },
  temptation: { pos: 'n.', zh: '诱惑' },
  hypocrisy: { pos: 'n.', zh: '虚伪' },
  prejudice: { pos: 'n.', zh: '偏见' },
  privilege: { pos: 'n.', zh: '特权，荣幸' },
  prosperity: { pos: 'n.', zh: '繁荣' },
  adversity: { pos: 'n.', zh: '逆境，不幸' },
  integrity: { pos: 'n.', zh: '正直；完整性' },
  humility: { pos: 'n.', zh: '谦逊' },
  curiosity: { pos: 'n.', zh: '好奇心' },
  resilience: { pos: 'n.', zh: '韧性，恢复力' },
};

const INFLECTIONS = ['s', 'es', 'ed', 'd', 'ing', 'ly', 'er', 'est'];

export function glossaryLookup(word: string): GlossEntry | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;
  if (GLOSSARY[w]) return GLOSSARY[w];
  for (const suffix of INFLECTIONS) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      if (GLOSSARY[stem]) return GLOSSARY[stem];
      if (GLOSSARY[stem + 'e']) return GLOSSARY[stem + 'e'];
      if (suffix === 'ing' && /([bdfglmnprt])\1$/.test(stem) && GLOSSARY[stem.slice(0, -1)]) {
        return GLOSSARY[stem.slice(0, -1)];
      }
    }
  }
  return null;
}

/** Very rough part-of-speech guess from morphology, used only offline. */
export function guessPos(word: string): string {
  const w = word.toLowerCase();
  if (/(tion|sion|ment|ness|ity|ance|ence|ism|ship|hood|dom|age)$/.test(w)) return 'n.';
  if (/(ous|ful|less|able|ible|al|ic|ive|ary|ory|ent|ant|ish|like)$/.test(w)) return 'adj.';
  if (/(ize|ise|ify|ate|en)$/.test(w)) return 'v.';
  if (/ly$/.test(w)) return 'adv.';
  return '';
}

export function offlineMeaning(word: string): { pos: string; zh: string; found: boolean } {
  const hit = glossaryLookup(word);
  if (hit) return { pos: hit.pos, zh: hit.zh, found: true };
  const pos = guessPos(word);
  return { pos, zh: '离线词库未收录，配置 LLM_API_KEY 后可获取准确释义', found: false };
}
