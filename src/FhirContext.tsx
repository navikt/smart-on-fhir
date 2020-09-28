import React, {useEffect, useState} from "react";
import {oauth2} from "fhirclient";
import Client from "fhirclient/lib/Client";
import {fhirclient} from "fhirclient/lib/types";

type ContextProps = {
    client: Client,
    patient: fhirclient.FHIR.Patient,
    error: Error
};
export const FhirContext = React.createContext<Partial<ContextProps>>({});

export interface RouteParams {
    iss: string,
    launch: string
}

export const FhirContextProvider = (props: any) => {
    const [client, setClient] = useState<Client>();
    const [patient, setPatient] = useState<fhirclient.FHIR.Patient>();
    const [error, setError] = useState<Error>();
    useEffect(() => {
        async function fetchData() {
            await oauth2.init({
                clientId: "whatever-you-want",
                scope: "launch launch/patient patient/read offline_access openid fhirUser",
                completeInTarget: true,
            });
            const res1 = await oauth2.ready();
            setClient(res1);
            if (res1) {
                const r2 = await res1.patient.read();
                setPatient(r2)
            }
        }

        try {
            fetchData()
        } catch (e) {
            setError(e)
        }

    }, []);

    const context = {
        client,
        error,
        patient,
    };
    return (
        <>
            <FhirContext.Provider value={context}>
                {props.children}
            </FhirContext.Provider>
        </>
    );
};
