import Head from 'next/head';

interface Props {
  title: string;
  description: string;
}

export default function Metadata({ title, description }: Props) {
  return (
    <Head>
      <title>{`${title} - Reciplease`}</title>
      <meta name='description' content={description} />
    </Head>
  );
}