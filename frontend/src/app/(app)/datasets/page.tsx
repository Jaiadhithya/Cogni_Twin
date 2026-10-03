import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata = { title: 'Datasets · CogniTwin' };

export default function Page() {
  return <ComingSoon title="Datasets" description="Everything you have uploaded. Choose the active dataset or delete one." phase={3} />;
}
