import { notFound } from 'next/navigation';
import { KitGallery } from './gallery';

export const metadata = { title: 'Component kit · CogniTwin' };

/** Development-only component gallery. Not linked from the sidebar; 404s in production. */
export default function KitPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <KitGallery />;
}
