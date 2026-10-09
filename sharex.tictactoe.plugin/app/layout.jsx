import "./globals.css";

export const metadata = {
  title: "Tic Tac Toe · ShareX",
  description: "A live two-player tic tac toe game powered by ShareX.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
