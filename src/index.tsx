import * as React from "react";
import * as ReactDOM from "react-dom";
import './index.less';
import App from './App';
import {FhirContextProvider} from "./FhirContext";
import {BrowserRouter, Route} from "react-router-dom";

ReactDOM.render(
    <>
        <BrowserRouter>
            <Route exact path="/">
                <FhirContextProvider>
                    <App/>
                </FhirContextProvider>
            </Route>
        </BrowserRouter>
    </>,
    document.getElementById('root')
);

