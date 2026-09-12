/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
    // Cteni posty s doklady (12. 9. 2026). Obe knihovny si za behu nacitaji
    // dalsi soubory (kodovani, slovniky MIME) - zabalene webpackem by je
    // v serverless funkci nenasly.
    serverComponentsExternalPackages: ['imapflow', 'mailparser'],
  },
};

export default nextConfig;
