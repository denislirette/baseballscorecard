import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'BaseballScorecard.org',
  description: 'System documentation for BaseballScorecard.org',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],

  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'BaseballScorecard.org Docs',

    nav: [
      { text: 'Live Site', link: 'https://baseballscorecard.org' },
      { text: 'GitHub', link: 'https://github.com/denislirette/baseballscorecard' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Home', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Origin Story', link: '/origin-story' },
        ],
      },
      {
        text: 'Scorekeeping',
        items: [
          { text: 'How to Read a Scorecard', link: '/scoring-notation' },
          { text: 'The Play Cell', link: '/play-cell' },
          { text: 'Diamond and Base Paths', link: '/diamond' },
          { text: 'Pitch Sequences', link: '/pitch-sequences' },
          { text: 'Substitutions', link: '/substitutions' },
          { text: 'Position Numbers', link: '/positions' },
          { text: 'Common Plays', link: '/common-plays' },
        ],
      },
      {
        text: 'Baseball Rules',
        items: [
          { text: 'Rules Reference', link: '/baseball-rules' },
        ],
      },
      {
        text: 'Design',
        items: [
          { text: 'Design System', link: '/design-system' },
          { text: 'Accessibility', link: '/ACCESSIBILITY' },
        ],
      },
      {
        text: 'Technical',
        items: [
          { text: 'Technical Reference', link: '/technical-reference' },
          { text: 'Release Notes', link: '/release-notes' },
          { text: 'Known Issues', link: '/known-issues' },
          { text: 'Contributing', link: '/CONTRIBUTING' },
          { text: 'Code of Conduct', link: '/CODE_OF_CONDUCT' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/denislirette/baseballscorecard/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },

    lastUpdated: true,

    footer: {
      message: 'All logos are the trademark and property of their owners and not BaseballScorecard.org.',
      copyright: '2026 BaseballScorecard.org',
    },
  },
})
