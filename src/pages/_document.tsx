import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    // The app is dark-only; set the class up front so there's no light flash
    // before the SettingsProvider hydrates (see src/lib/settings.tsx).
    <Html lang='en' className='theme-dark'>
      <Head>
        <link rel='apple-touch-icon' href='/logo192.png' />
        {/*manifest.json provides metadata used when your web app is installed on a*/}
        {/*user's mobile device or desktop. See https://developers.google.com/web/fundamentals/web-app-manifest/*/}
        <link rel='manifest' href='/api/manifest' />
        <link rel='icon' href='/reciplease-book.svg' />
      </Head>
      <body>
        <Main />
        <NextScript />
        {/* Registering a service worker is required for Chrome to consider the */}
        {/* app installable (Add to Home Screen on Android). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js')); }`,
          }}
        />
      </body>
    </Html>
  );
}
