// Best-effort gender guess for a character cue. Anything this isn't sure about
// comes back "unknown" — the app asks with one tap rather than guessing.

const FEMALE = `abigail ada adelaide adriana agatha agnes aisha alice alison amanda amelia amy ana anastasia andrea angela anita ann anna annabelle anne annie antigone aphrodite april ariel arlene ashley astrid athena audrey aurora ava barbara beatrice belle bernadette bertha bess bessie beth bethany betty beverly bianca blanche bonnie brenda bridget britney brooke calpurnia camille candace carla carmen carol caroline carrie cassandra catherine cecile cecilia celia charlotte chelsea cherry cheryl chloe christine cindy claire clara clarice claudia cleopatra clytemnestra colette connie constance cora cordelia corinne courtney cynthia daisy dana daphne darlene dawn deborah deirdre delia delilah denise desdemona diana diane dolores donna dora doris dorothy edith edna eileen elaine eleanor electra elena elise eliza elizabeth ella ellen ellie eloise elsa emilia emily emma erica erin esme esther ethel eudora eugenia eunice eva evelyn faith fanny fatima faye felicity fiona flora florence frances francesca freda frida gabrielle gail gemma genevieve georgia geraldine gertrude gigi gina ginny gladys glenda gloria grace greta gretchen guinevere gwen gwendolyn hannah harriet hattie hazel heather hecuba hedda helen helena heloise henrietta hermia hermione hester hilda holly honor hope imogen ines ingrid irene iris isabel isabella isadora ivy jackie jacqueline jade jane janet janice jasmine jean jeanette jenny jessica jill joan joanna jocasta jocelyn jodie johanna josephine joy joyce juanita judith judy julia juliet julie june juno kaitlyn karen kate katherine kathleen kathy katie katrina kay kelly kim kimberly kirsten kitty krista kristen lady laura lauren laurie lavinia leah leigh lena leonora leslie letitia libby lila lillian lily linda lisa liza lois lola lorraine louise lucille lucinda lucy luisa lulu lydia lynn mabel madeline madge madonna mae maggie maisie mallory mamie mandy marcia margaret margery maria mariah marian marianne marie marilyn marion marjorie marlene marsha martha mary matilda maude maureen mavis maxine may maya meg megan melanie melissa mercedes meredith mia michelle mildred millie mimi minnie miranda miriam mitzi moira molly mona monica muriel myra myrtle nadia nan nancy naomi natalie natasha nell nellie nerissa nicole nina nora norma octavia odette olga olive olivia opal ophelia pamela pat patience patricia patsy paula pauline pearl peggy penelope penny persephone petra phoebe phyllis polly portia priscilla prudence rachel ramona raquel rebecca regan regina renee rhoda rhonda rita roberta robin rosa rosalind rose rosemary rowena roxane ruby ruth sabrina sadie sally salome samantha sandra sara sarah sasha scarlett selina serena shanna sharon sheila shelby shelley sherry shirley sibyl sidney silvia simone sonia sonya sophia sophie stella stephanie sue susan susannah suzanne sybil sylvia tamara tammy tanya tara teresa tess thelma theodora theresa tiffany tina titania tracy trudy ursula val valentina valerie vanessa velma vera verna veronica vicky victoria viola violet virginia vivian wanda wendy whitney wilhelmina willa wilma winifred yolanda yvette yvonne zelda zoe`.split(/\s+/);

const MALE = `aaron abe abel abraham achilles adam adrian aeneas agamemnon ajax al alan albert alec alex alexander alfred algernon ali allan alonzo alvin ambrose amos anatole andre andrew angelo angus anthony antonio antony archie aristotle arnold arthur arturo asa augustus austin avery bailey balthazar barnaby barney barry bart bartholomew basil beau ben benedick benedict benjamin bennett benny bernard bert bertram bill billy bob bobby boris brad bradley brandon brendan brent brett brian bruce bruno bryan bud buddy burt byron caesar cain caleb calvin cameron carl carlos casey caspar cassio cecil cedric chad charles charlie chester chris christian christopher chuck claude claudio claudius clay clayton clement cliff clifford clifton clint clive clyde cody colin conrad cornelius craig curtis cyril cyrus dale damian dan daniel dante darius darrell darren dave david dean dennis derek desmond dexter dick diego dmitri dominic don donald doug douglas duane duke duncan dustin dwight earl earnest ed eddie edgar edmund eduardo edward edwin egbert eli elias elijah elliot ellis elmer elton emanuel emil emmett enrique erik ernest ernie errol ervin esteban ethan eugene evan everett ezra fabian felix ferdinand fergus fernando fitz flavio floyd forrest francis francisco frank franklin fred freddie frederick fritz gabriel gareth garrett garth gary gaston gavin gene geoffrey george gerald gerard gil gilbert giles glen glenn godfrey gordon graham grant greg gregory griffin guy hal hamlet hank hans harold harry hartley harvey hector henry herbert herman hiram homer horace horatio howard hubert hugh hugo humphrey ian ignatius igor ira irving isaac isaiah ivan jack jackson jacob jake james jamie jared jason jasper javier jay jed jeff jeffrey jeremiah jeremy jerome jerry jesse jim jimmy joe joel john johnny jonah jonathan jordan jorge jose joseph josh joshua juan judah jude jules julian julius justin karl keith ken kenneth kevin kirk kurt kyle lambert lance larry laurence lawrence lee leland lem leo leon leonard leopold leroy leslie lester levi lewis liam lincoln lionel lloyd logan lorenzo louis lucas lucius luigi luis luke luther lyle malcolm manuel marc marcel marco marcus mario mark marlon marshall martin marvin mason mat matt matthew maurice max maximilian maynard mel melvin mercutio merlin micah michael miguel mike miles milton mitchell mohammed monty morgan morris mortimer moses murray nate nathan nathaniel ned neil nelson neville nicholas nick nigel noah noel norman oberon octavius odysseus oliver olivier omar orlando orson oscar oswald othello otis otto owen pablo paolo pascal pat patrick paul pedro percival percy perry pete peter phil philip pierre polonius preston prospero puck quentin quincy rafael raj ralph ramon randall randolph randy raoul raphael raul ray raymond reginald rene reuben rex rhett ricardo richard rick ricky rob robert roberto robin roderick rodney roger roland rolf romeo ron ronald rory ross roy royce rudolph rudy rufus rupert russell rusty ryan sal salvatore sam samson samuel sancho sandy santiago saul scott sean sebastian serge seth seymour shane shaun shawn sheldon sidney silas simon solomon spencer stan stanley stefan stephen steve steven stewart stuart sydney sylvester tanner ted terence terry thaddeus theo theodore thomas tim timothy tobias toby todd tom tommy tony travis trent trevor tristan troy tybalt tyler tyrone ulysses upton urban valentine van vaughn vernon victor vince vincent virgil vito vladimir wade wallace walter ward warren wayne wendell wesley wilbur wiley wilfred will willard william willie willis wilson winston wolfgang woody wyatt xavier yuri zachary zeke`.split(/\s+/);

const F = new Set(FEMALE);
const M = new Set(MALE);

// Titles and role words that settle it on their own.
const FEMALE_WORDS = /\b(mrs|ms|miss|madam|madame|lady|queen|princess|duchess|countess|baroness|dame|mother|mom|mum|mama|grandma|granny|nana|aunt|auntie|sister|daughter|wife|widow|girl|woman|women|waitress|actress|nun|nurse|hostess|maid|matron|bride|niece|witch|goddess|empress|marchioness|abbess|schoolgirl|saleswoman|barmaid|stewardess|female)\b/i;
const MALE_WORDS = /\b(mr|sir|lord|king|prince|duke|earl|count|baron|father|dad|daddy|papa|pop|grandpa|grandad|granddad|uncle|brother|son|husband|widower|boy|man|men|guy|fellow|waiter|actor|monk|priest|friar|groom|nephew|wizard|god|emperor|marquis|abbot|schoolboy|salesman|barman|steward|male)\b/i;

/** Strip the theatrical scaffolding off a cue: "HAMLET (O.S.)" -> "hamlet". */
export function normalizeName(raw) {
  return String(raw)
    .replace(/\((?:[^)]*)\)/g, ' ')
    .replace(/\b(v\.?o\.?|o\.?s\.?|o\.?c\.?|cont'?d|continued|contd|off|offstage|aside|within)\b/gi, ' ')
    .replace(/[.:,'"’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @returns {'female'|'male'|'unknown'}
 */
export function guessGender(rawName) {
  const name = normalizeName(rawName);
  if (!name) return 'unknown';

  if (FEMALE_WORDS.test(name) && !MALE_WORDS.test(name)) return 'female';
  if (MALE_WORDS.test(name) && !FEMALE_WORDS.test(name)) return 'male';

  const words = name.split(' ');
  for (const w of words) {
    if (F.has(w) && !M.has(w)) return 'female';
    if (M.has(w) && !F.has(w)) return 'male';
  }
  // Common feminine endings, only as a last resort and only for names long
  // enough that the ending means something.
  const first = words[0] ?? '';
  if (first.length >= 5 && /(?:ella|etta|ina|issa|iana)$/.test(first)) return 'female';
  return 'unknown';
}

/** Pretty-print a cue for display: HAMLET stays HAMLET, "Hamlet" stays "Hamlet". */
export function displayName(raw) {
  return String(raw).replace(/\s+/g, ' ').trim();
}
