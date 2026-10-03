import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata = { title: 'Ask AI · CogniTwin' };

export default function Page() {
  return <ComingSoon title="Ask AI" description="Ask questions about your business in plain English and get answers with charts." phase={2} legacyHref="/query" />;
}
