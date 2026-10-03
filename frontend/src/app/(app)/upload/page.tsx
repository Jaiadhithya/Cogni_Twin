import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata = { title: 'Upload Data · CogniTwin' };

export default function Page() {
  return <ComingSoon title="Upload Data" description="Upload a CSV of your sales and CogniTwin builds your digital twin." phase={2} legacyHref="/ingest" />;
}
