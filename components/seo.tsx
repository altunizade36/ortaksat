import Head from "expo-router/head";

/**
 * Sayfa SEO başlığı/açıklaması — tek satırda benzersiz title + description +
 * canonical + Open Graph. Statik export'ta arama motorları bunu okur.
 */
export function Seo({
  title,
  description,
  path,
  image = "https://www.ortaksat.com/og-cover.png",
  noindex
}: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noindex?: boolean;
}) {
  const url = path ? `https://www.ortaksat.com${path}` : undefined;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex, follow" /> : null}
      {url ? <link rel="canonical" href={url} /> : null}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="OrtakSat" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {url ? <meta property="og:url" content={url} /> : null}
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Head>
  );
}
