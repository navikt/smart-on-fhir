import * as React from "react";
import logo from './logo.svg';
import './App.less';
import {useContext} from "react";
import {FhirContext} from "./FhirContext";

function App() {
  const context = useContext(FhirContext);
  console.log(context.patient)

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <pre style={{color:"black",fontSize:9,textAlign:"left",position:"relative"}}>
          {JSON.stringify(context.patient,null, 4)}
        </pre>
      </header>
    </div>
  );
}

export default App;
