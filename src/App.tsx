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
import { useI18n } from './i18n/i18n';

export default function App() {
  const { t } = useI18n();
  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <Background />
      <Nav />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Racing />
        <Orbitarium />
        <Prompts />
        <Archive />
      </main>
      <Footer />
      <MotionNotice />
      <CompareBar />
    </>
  );
}
