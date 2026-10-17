import PaperCity from '@/components/paper-city';
import snapshot from '@/data/housing.json';

export default function Home() {
  return <PaperCity snapshot={snapshot} />;
}
