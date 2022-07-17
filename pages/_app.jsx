import "../styles/global.css";

export default function SubuxApp({ Component, pageProps }) {
  return (
    <div className="container px-8 lg:mx-auto lg:px-0">
      <Component {...pageProps} />
    </div>
  );
}
