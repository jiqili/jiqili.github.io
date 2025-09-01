import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)
const config: Config = {
  title: 'Jiqi\'s Blog',
  tagline: 'I am a software engineer who loves to learn and share knowledge.',
  favicon: 'img/github-avatar.jpeg',

  // Set the production url of your site here
  url: 'https://jiqili.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: process.env.BASEURL,
  organizationName: 'jiqili',
  projectName: 'jiqili.github.io',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  plugins: [
    [
      '@docusaurus/plugin-content-blog',
      {
        id: 'web',
        path: './web', 
        routeBasePath: 'web',
        blogSidebarTitle: 'All posts',
        blogSidebarCount: 'ALL',
      },
    ],
    [
      '@docusaurus/plugin-content-blog',
      {
        id: 'ai',
        path: './ai',
        routeBasePath: 'ai',
        blogSidebarTitle: 'All posts',
        blogSidebarCount: 'ALL',
      },
    ],
  ],
  presets: [
    [
      'classic',
      {
        docs: false,
        blog: {

          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/jiqili/blog/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Jiqi\'s Blog',
      logo: {
        alt: 'Jiqi\'s Blog Logo',
        src: 'img/github-avatar.jpeg',
      },
      items: [
        {to: '/web', label: 'Web', position: 'left'},
        {to: '/ai', label: 'AI', position: 'left'},
        {
          href: 'https://github.com/jiqili',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} Jiqi\'s blog. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
