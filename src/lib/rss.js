import supabase from './supabase'

// SYNC: cette liste doit rester identique à SYSTEM_FEEDS dans supabase/functions/fetch-rss/index.ts
// (impossible de partager le fichier : Supabase Edge Functions ne remonte pas les imports hors de son répertoire)
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
  const batchSize = 3
  let batchOffset = 0
  let totalInserted = 0

  while (true) {
    const { data, error } = await supabase.functions.invoke('fetch-rss', {
      body: { feeds: RSS_FEEDS, batchOffset, batchSize },
    })
    if (error) {
      console.error('[fetch-rss] invoke error:', error)
      throw error
    }
    totalInserted += data.inserted ?? 0
    console.log(`[fetch-rss] batch ${batchOffset}: ${data.inserted} insérés`)
    if (!data.hasMore) break
    batchOffset = data.nextOffset
  }

  console.log(`[fetch-rss] total: ${totalInserted} insérés`)
  return totalInserted
}

export const PAGE_SIZE = 20

// Charge une page d'articles, filtres appliqués au niveau requête (thème text[] + non-lus).
// Retourne { articles, hasMore }. On demande limit+1 pour savoir s'il reste une page.
export const loadArticles = async ({ theme = 'Tous', unreadOnly = false, offset = 0, limit = PAGE_SIZE } = {}) => {
  let query = supabase
    .from('watch_items')
    .select('*')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit) // limit+1 lignes pour détecter hasMore

  if (theme !== 'Tous') query = query.contains('tags', [theme])
  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > limit
  return { articles: hasMore ? rows.slice(0, limit) : rows, hasMore }
}
