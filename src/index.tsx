import * as React from "react";
import * as ReactDOM from "react-dom";
import './index.less';
import StartPage from './pages/StartPage';
import {FhirContextProvider} from "./FhirContext";
import {BrowserRouter, Route} from "react-router-dom";
import AnotherPage from "./pages/AnotherPage";

ReactDOM.render(
    <>
        <BrowserRouter>
            <FhirContextProvider>
                <Route exact path="/">
                    <StartPage/>
                </Route>
                <Route exact path="/another-page">
                    <AnotherPage/>
                </Route>
            </FhirContextProvider>
        </BrowserRouter>
    </>,
    document.getElementById('root')
);

