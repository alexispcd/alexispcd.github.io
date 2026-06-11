import supabase from './supabase'

export const RSS_FEEDS = [
  { name: 'Le Monde Informatique', url: 'https://www.lemondeinformatique.fr/flux-rss.xml', theme: 'Optimisation du SI' },
  { name: 'Journal du Net', url: 'https://www.journaldunet.com/rss/', theme: 'Management et stratégie' },
  { name: 'ZDNet France', url: 'https://www.zdnet.fr/feeds/rss/actualites/', theme: 'Développement' },
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', theme: 'Cybersécurité' },
  { name: 'ANSSI', url: 'https://www.ssi.gouv.fr/feed/', theme: 'Cybersécurité' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', theme: 'Cybersécurité' },
  { name: 'AWS Blog', url: 'https://aws.amazon.com/blogs/aws/feed/', theme: 'Cloud et virtualisation' },
  { name: 'InfoQ Cloud', url: 'https://feed.infoq.com/cloud', theme: 'Cloud et virtualisation' },
  { name: 'Anthropic Blog', url: 'https://www.anthropic.com/rss.xml', theme: 'Intelligence artificielle' },
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', theme: 'Intelligence artificielle' },
  { name: 'dev.to', url: 'https://dev.to/feed', theme: 'Développement' },
  { name: 'CSS Tricks', url: 'https://css-tricks.com/feed/', theme: 'Développement' },
  { name: 'Towards Data Science', url: 'https://towardsdatascience.com/feed', theme: 'Big Data' },
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', theme: 'Blockchain' },
]

export const fetchRssFeeds = async () => {
  const { error } = await supabase.functions.invoke('fetch-rss', {
    body: { feeds: RSS_FEEDS },
  })
  if (error) throw error
}

export const loadArticles = async () => {
  const { data, error } = await supabase
    .from('watch_items')
    .select('*')
    .order('published_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
