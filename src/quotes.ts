import { i18n } from './lib/i18n';

// English quotes
const enQuotes = [
  "The only impossible journey is the one you never begin.",
  "Life is either a daring adventure or nothing at all.",
  "Don't be pushed by your problems. Be led by your dreams.",
  "The biggest adventure you can take is to live the life of your dreams.",
  "Your time is limited, don't waste it living someone else's life.",
  "The only way to do great work is to love what you do.",
  "Life is too short to be stuck in a job you hate.",
  "Dream big, work hard, stay focused, and surround yourself with good people.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "Don't count the days, make the days count.",
  "Life begins at the end of your comfort zone.",
  "The world is a book, and those who do not travel read only one page.",
  "Jobs fill your pocket, but adventures fill your soul.",
  "Escape the ordinary, embrace the extraordinary.",
  "Your dreams don't have an expiration date. Take a deep breath and try again.",
  "Sometimes you need to step outside, get some air, and remind yourself of who you are.",
  "The cave you fear to enter holds the treasure you seek.",
  "Life is short. Break the rules, forgive quickly, kiss slowly, love truly.",
  "Twenty years from now you will be more disappointed by the things you didn't do.",
  "The only person you are destined to become is the person you decide to be.",
];

// Simplified Chinese quotes
const zhCnQuotes = [
  "生活不是等待风暴过去，而是学会在雨中跳舞。",
  "真正的自由，是勇敢地去做你热爱的事。",
  "梦想从不是奢侈品，而是生活的必需品。",
  "不要让别人的眼光，成为你前行的枷锁。",
  "人生最精彩的不是实现梦想的瞬间，而是坚持梦想的过程。",
  "每一次跑路，都是对生活的一次重新定义。",
  "勇敢地跳出舒适圈，你会发现更广阔的天地。",
  "生活不只有眼前的苟且，还有诗和远方。",
  "别让日复一日的重复，磨平了你的棱角和梦想。",
  "有时候，逃离也是一种智慧，一种对更好生活的追求。",
  "人生太短，要把时间浪费在美好的事物上。",
  "你的人生，应该由你自己书写。",
  "梦想就像星星，即使摸不到，也能指引你前行。",
  "不要被所谓的\"稳定\"，束缚了你探索世界的脚步。",
  "每一次选择，都是一次新的开始。",
  "生活的意义，在于不断追求和突破自我。",
  "勇敢地做自己，这是世界上最勇敢的事。",
  "未来的你，一定会感谢现在勇敢的自己。",
  "生命只有一次，要活成自己喜欢的样子。",
  "跑路，不是逃避，而是寻找更适合自己的生活方式。",
];

// Traditional Chinese quotes
const zhTwQuotes = [
  "生活不是等待風暴過去，而是學會在雨中跳舞。",
  "真正的自由，是勇敢地去做你熱愛的事。",
  "夢想從不是奢侈品，而是生活的必需品。",
  "不要讓別人的眼光，成為你前行的枷鎖。",
  "人生最精彩的不是實現夢想的瞬間，而是堅持夢想的過程。",
  "每一次跑路，都是對生活的一次重新定義。",
  "勇敢地跳出舒適圈，你會發現更廣闊的天地。",
  "生活不只有眼前的苟且，還有詩和遠方。",
  "別讓日復一日的重複，磨平了你的棱角和夢想。",
  "有時候，逃離也是一種智慧，一種對更好生活的追求。",
  "人生太短，要把時間浪費在美好的事物上。",
  "你的人生，應該由你自己書寫。",
  "夢想像星星，即使摸不到，也能指引你前行。",
  "不要被所謂的\"穩定\"，束縛了你探索世界的腳步。",
  "每一次選擇，都是一次新的開始。",
  "生活的意義，在於不斷追求和突破自我。",
  "勇敢地做自己，這是世界上最勇敢的事。",
  "未來的你，一定會感謝現在勇敢的自己。",
  "生命只有一次，要活成自己喜歡的樣子。",
  "跑路，不是逃避，而是尋找更適合自己的生活方式。",
];

// Get quotes based on current language
const getQuotesByLanguage = () => {
  const lang = i18n.getLanguage();
  
  switch (lang) {
    case 'zh_cn':
      return zhCnQuotes;
    case 'zh_tw':
      return zhTwQuotes;
    default:
      return enQuotes;
  }
};

export const getRandomQuote = (): string => {
  const quotes = getQuotesByLanguage();
  return quotes[Math.floor(Math.random() * quotes.length)];
};
