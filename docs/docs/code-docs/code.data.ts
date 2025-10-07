import { execSync } from 'node:child_process'

export default {
    watch: ['../../../src/client/smart/**/*.ts'],
    load() {
        const denoDocResult = execSync(
            'deno doc --json src/client/smart/SmartClient.ts src/client/smart/ReadyClient.ts',
        )
        const raw = JSON.parse(denoDocResult.toString())

        const smartClient = raw.nodes.find((it) => it.name === 'SmartClient' && it.kind === 'class')
        const readyClient = raw.nodes.find((it) => it.name === 'ReadyClient' && it.kind === 'class')

        return {
            SmartClient: structureClassDocs(smartClient),
            ReadyClient: structureClassDocs(readyClient),
        }
    },
}

function structureClassDocs(node: any) {
    if (!node) return null

    const description = node?.jsDoc?.doc ?? null
    const publicFns = node?.classDef?.methods?.filter((it) => it.accessibility !== 'private') ?? []

    return {
        description: description,
        methods: publicFns.map((it) => ({
            name: it.name,
            description: it.jsDoc?.doc ?? null,
        })),
    }
}
