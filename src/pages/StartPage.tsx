import * as React from "react";
import {useContext} from "react";
import {FhirContext} from "../FhirContext";

function StartPage() {
  const context = useContext(FhirContext);
  return (
      <div className="App">
        <header className="App-header">
          <p>
            This is the start page
          </p>
          <a
              className="App-link"
              href="/another-page"
              target="_self"
              rel="noopener noreferrer"
          >
            Another Page
          </a>
          <pre style={{color: "black", fontSize: 9, textAlign: "left", position: "relative"}}>
          {JSON.stringify(context.patient, null, 4)}
        </pre>
      </header>
    </div>
  );
}

export default StartPage;
