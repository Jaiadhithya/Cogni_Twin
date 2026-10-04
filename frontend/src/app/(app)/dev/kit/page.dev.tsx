import { KitGallery } from './gallery';

export const metadata = { title: 'Component kit · CogniTwin' };

/** Development-only component gallery. Not linked from the nav; not a route in production builds (see pageExtensions in next.config.ts). */
export default function KitPage() {
  return <KitGallery />;
}
