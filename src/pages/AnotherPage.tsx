import * as React from "react";
import {useContext} from "react";
import {FhirContext} from "../FhirContext";

function AnotherPage() {
    const context = useContext(FhirContext);
    return (
        <div className="App">
            <header className="App-header">
                <p>
                    This is another page
                </p>
                <a
                    className="App-link"
                    href="/"
                    target="_self"
                    rel="noopener noreferrer"
                >
                    Back to the first url
                </a>
                <pre style={{color: "black", fontSize: 9, textAlign: "left", position: "relative"}}>
          {JSON.stringify(context.patient, null, 4)}
        </pre>
            </header>
        </div>
    );
}

export default AnotherPage;
