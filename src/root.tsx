import {component$, useStyles$} from "@builder.io/qwik";
import {
    QwikCityProvider,
    RouterOutlet,
    ServiceWorkerRegister,
} from "@builder.io/qwik-city";
import {RouterHead} from "./components/router-head/router-head";
import {isDev} from "@builder.io/qwik";
import styles from './global.css?inline';

export default component$(() => {
    useStyles$(styles);

    return (
        <QwikCityProvider>
            <head>
                <meta charSet="utf-8"/>
                {!isDev && (
                    <link
                        rel="manifest"
                        href={`${import.meta.env.BASE_URL}manifest.json`}
                    />
                )}
                <RouterHead/>
            </head>
            <body lang="ko">
            <RouterOutlet/>
            {!isDev && <ServiceWorkerRegister/>}
            </body>
        </QwikCityProvider>
    );
});
