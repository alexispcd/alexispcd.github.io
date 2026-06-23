import supabase from './supabase'

export const RSS_FEEDS = [
  { name: 'Le Monde Informatique', url: 'https://www.lemondeinformatique.fr/flux-rss/thematique/toute-l-informatique/1.xml', theme: 'Optimisation du SI' },
  { name: 'Journal du Net', url: 'https://www.journaldunet.com/rss/', theme: 'Management et stratégie' },
  { name: 'ZDNet France', url: 'https://www.zdnet.fr/feeds/rss/actualites/', theme: 'Développement' },
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', theme: 'Cybersécurité' },
  { name: 'ANSSI', url: 'https://www.cert.ssi.gouv.fr/feed/', theme: 'Cybersécurité' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', theme: 'Cybersécurité' },
  { name: 'AWS Blog', url: 'https://aws.amazon.com/blogs/aws/feed/', theme: 'Cloud et virtualisation' },
  { name: 'InfoQ Cloud', url: 'https://feed.infoq.com/cloud', theme: 'Cloud et virtualisation' },
  { name: 'Anthropic Blog', url: 'https://www.anthropic.com/news/rss.xml', theme: 'Intelligence artificielle' },
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', theme: 'Intelligence artificielle' },
  { name: 'dev.to', url: 'https://dev.to/feed', theme: 'Développement' },
  { name: 'CSS Tricks', url: 'https://css-tricks.com/feed/', theme: 'Développement' },
  { name: 'Towards Data Science', url: 'https://medium.com/feed/towards-data-science', theme: 'Big Data' },
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', theme: 'Blockchain' },
  { name: 'GreenIT.fr', url: 'https://www.greenit.fr/feed/', theme: 'SI et environnement' },
  { name: 'FrAndroid', url: 'https://www.frandroid.com/feed', theme: 'Mobilité' },
  { name: 'InfoQ Mobile', url: 'https://feed.infoq.com/mobile/', theme: 'Mobilité' },
  { name: 'Usine Digitale', url: 'https://www.usine-digitale.fr/rss', theme: 'Management et stratégie' },
  { name: 'Clubic', url: 'https://www.clubic.com/feed/news.rss', theme: 'Optimisation du SI' },
  { name: 'InfoQ Architecture', url: 'https://feed.infoq.com/architecture-design/', theme: 'Cloud et virtualisation' },
  { name: 'InfoQ AI/ML/Data', url: 'https://feed.infoq.com/ai-ml-data-eng/', theme: 'Big Data' },
]

export const fetchRssFeeds = async () => {
  const { data, error } = await supabase.functions.invoke('fetch-rss', {
    body: { feeds: RSS_FEEDS },
  })
  if (error) {
    console.error('[fetch-rss] invoke error:', error)
    throw error
  }
  console.log('[fetch-rss] result:', data)
}

export const loadArticles = async () => {
  const { data, error } = await supabase
    .from('watch_items')
    .select('*')
    .order('published_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
