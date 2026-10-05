import './globals.css';

export const metadata = { title: 'ShareX Starter Plugin', description: 'Live plugin development with ShareX' };

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
