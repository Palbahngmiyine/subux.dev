import "../styles/global.css";

export default function SubuxApp({ Component, pageProps }) {
  return (
    <div className="container px-16 py-8 mx-auto">
      <Component {...pageProps} />
    </div>
  );
}
