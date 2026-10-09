import './globals.css';

export const metadata = { title: 'Bingo · ShareX', description: 'A live two-player Bingo game powered by ShareX.' };

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
