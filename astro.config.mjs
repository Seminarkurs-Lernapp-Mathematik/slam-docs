import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.learn-smart.app',
  integrations: [
    starlight({
      title: 'SLAM Docs',
      logo: { src: './src/assets/logo.svg' },
      defaultLocale: 'root',
      locales: {
        root: { label: 'Deutsch', lang: 'de' },
        // en: { label: 'English', lang: 'en' }, // TODO: aktivieren wenn EN-Inhalte unter src/content/docs/en/ liegen
      },
      social: [
        { icon: 'github', label: 'App',     href: 'https://github.com/Seminarkurs-Lernapp-Mathematik/slam-app' },
        { icon: 'github', label: 'Backend', href: 'https://github.com/Seminarkurs-Lernapp-Mathematik/slam-backend' },
        { icon: 'github', label: 'Teacher', href: 'https://github.com/Seminarkurs-Lernapp-Mathematik/slam-teacher' },
        { icon: 'github', label: 'Docs',    href: 'https://github.com/Seminarkurs-Lernapp-Mathematik/slam-docs' },
      ],
      sidebar: [
        {
          label: 'Erste Schritte',
          items: [
            { label: 'Übersicht',          link: '/getting-started/' },
            { label: 'Schüler-Quickstart', link: '/getting-started/schueler/' },
            { label: 'Lehrer-Quickstart',  link: '/getting-started/lehrer/' },
          ],
        },
        { label: 'Architektur', link: '/architektur/' },
        { label: 'Komponenten', autogenerate: { directory: 'komponenten' } },
        { label: 'Sicherheit',  link: '/sicherheit/' },
        { label: 'Technisch',   autogenerate: { directory: 'technisch' } },
      ],
    }),
  ],
});
