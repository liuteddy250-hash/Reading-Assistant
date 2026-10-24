/**
 * A pragmatic "common vocabulary" list. Words in this list are never
 * highlighted as difficult. It is intentionally heuristic (a real product
 * should use a frequency list such as COCA / wordfreq), and swapping the set
 * is the single place to tune highlighting sensitivity.
 */
const COMMON_RAW = `
a about above across act actually add after again against age ago agree air all allow almost alone along already also although always among amount an and another answer any anyone anything appear apply area around as ask at away
back bad be became because become been before begin behind being believe below best better between beyond big both bring build business but buy by
call can care carry case catch cause center century certain chance change check child choose city class clear close come common company compare complete concern condition consider continue control cost could country course cover create current cut
day deal decide decision deep detail develop did die differ different difficult do does done door down draw drive drop during
each early easy eat education effect effort eight either else end enough enter entire even ever every everyone everything evidence example exist expect experience explain eye
face fact fail fall family far father fear feel few field fight figure fill find fine fire first five follow food foot for force form former forward four free friend from front full fund future
game general get girl give glass go goal good government great green grow group guess guy
hair half hand happen happy hard have he head hear heart heavy help her here herself high him himself his history hold home hope horse hospital hot hour house how however huge human hundred husband
idea if image imagine impact important improve in include increase indeed individual industry information inside instead interest into investment involve issue it item its itself
job join just
keep key kid kill kind kitchen know
land language large last late later laugh law lay lead learn least leave left leg less let letter level lie life light like likely line list little live local long look lose lot love low
machine main maintain major make man manage many market marriage material may maybe me mean measure media medical meet member mention message method middle might military million mind minute miss model modern moment money month more morning most mother mouth move movement much music must my myself
name nation national natural nature near nearly necessary need network never new news next nice night no none nor not note nothing notice now number
occur of off offer office officer official often oh oil ok old on once one only open operation opportunity option or order organization other others our out outside over own owner
page pain paper parent part particular partner party pass past patient pattern pay peace people per perhaps period person phone pick picture piece place plan plant play point police policy political poor popular population position possible power practice prepare present president pressure pretty prevent price private probably problem process produce product program project property protect prove provide public pull purpose push put
quality question quickly quite
race radio raise range rate rather reach read ready real reality realize really reason receive recent recognize record red reduce reflect region relate relationship religious remain remember remove report represent require research resource respond response rest result return reveal rich right rise risk road rock role room rule run
safe same save say scene school science score sea season seat second section security see seek seem sell send sense series serious serve service set seven several shake share she shoot short should shoulder show side sign significant similar simple simply since sing single sister sit site situation six size skill skin small smile so social society soldier some somebody someone something sometimes son song soon sort sound source south space speak special specific speech spend sport spring staff stage stand standard star start state station stay step still stock stop store story strategy street strong structure student study stuff style subject success such suddenly suffer suggest summer support sure surface system
table take talk task tax teach teacher team technology tell ten term test than thank that the their them themselves then theory there these they thing think third this those though thought thousand threat three through throughout throw thus time to today together tonight too top total tough toward town trade traditional training travel treat tree trial trip trouble true truth try turn two type
under understand unit until up upon us use usually
value various very victim view violence visit voice vote
wait walk wall want war watch water way we weapon wear week weight well west what whatever when where whether which while white who whole whom whose why wide wife will win wind window wish with within without woman wonder word work worker world worry would write writer wrong
yard yeah year yes yet you young your yourself
example research method process system development environment energy health culture economy company customer service project policy court crisis growth solution factor feature benefit advantage disadvantage risk challenge goal target strategy action activity behavior attitude ability knowledge argument opinion concept theory model data analysis
`;

export const COMMON_WORDS: ReadonlySet<string> = new Set(
  COMMON_RAW.split(/\s+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean),
);

const SUFFIXES = ['ing', 'edly', 'ies', 'ied', 'es', 'ed', 'ly', 'er', 'est', 's'];

/** True when the word (or a plausible base form) is in the common list. */
export function isCommonWord(word: string): boolean {
  const w = word.toLowerCase();
  if (COMMON_WORDS.has(w)) return true;
  for (const suffix of SUFFIXES) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      if (COMMON_WORDS.has(stem)) return true;
      if (COMMON_WORDS.has(stem + 'e')) return true;
      if (suffix === 'ies' && COMMON_WORDS.has(stem + 'y')) return true;
      if (suffix === 'ied' && COMMON_WORDS.has(stem + 'y')) return true;
      if (/([bdfglmnprt])\1$/.test(stem) && COMMON_WORDS.has(stem.slice(0, -1))) return true;
    }
  }
  return false;
}
