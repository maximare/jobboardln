export const metadata = {
  title: "IT Job Board",
  description: "IT oglasi za posao grupisani po kategorijama",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
