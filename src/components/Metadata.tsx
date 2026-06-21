import Head from 'next/head';

interface Props {
  title: string;
  description: string;
}

// og:title/og:description matter beyond <title>/meta description: link-preview
// bots (WhatsApp, Slack, iMessage, ...) prefer Open Graph tags and don't always
// fall back to <title> the same way browsers do.
export default function Metadata({ title, description }: Props) {
  const fullTitle = `${title} - Reciplease`;
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name='description' content={description} />
      <meta property='og:title' content={fullTitle} />
      <meta property='og:description' content={description} />
      <meta property='og:type' content='website' />
    </Head>
  );
}
