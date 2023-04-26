import {Html, Head, Main, NextScript} from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="apple-touch-icon" href="/logo192.png"/>
        {/*manifest.json provides metadata used when your web app is installed on a*/}
        {/*user's mobile device or desktop. See https://developers.google.com/web/fundamentals/web-app-manifest/*/}
        <link rel="manifest" href="/manifest.json"/>
        <link rel="icon" href="/reciplease-book.svg"/>
      </Head>
      <body>
      <Main/>
      <NextScript/>
      </body>
    </Html>
  )
}
