import { useEffect } from 'react';
import Background from './components/Background';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Racing from './components/Racing';
import Orbitarium from './components/Orbitarium';
import Prompts from './components/Prompts';
import Archive from './components/Archive';
import Footer from './components/Footer';
import CompareBar from './components/CompareBar';
import MotionNotice from './components/MotionNotice';
import Loader from './components/Loader';
import RaceMap from './components/race/RaceMap';
import { useI18n } from './i18n/i18n';
import { watchZone } from './lib/zone';

export default function App() {
  const { t } = useI18n();
  // Race above the finish line, space below it: the floating UI changes skin with the zone.
  useEffect(() => watchZone(), []);
  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <Background />
      <Nav />
      {/* The map, the broken end of the road and the cars sit behind <main>, in page coordinates. */}
      <div className="page">
        <RaceMap />
        <main id="main" tabIndex={-1}>
          <Hero />
          <Racing />
          <Orbitarium />
          <Prompts />
          <Archive />
        </main>
        <Footer />
      </div>
      <MotionNotice />
      <CompareBar />
      <Loader />
    </>
  );
}
