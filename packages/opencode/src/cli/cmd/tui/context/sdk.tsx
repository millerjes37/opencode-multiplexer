import { createOpencodeClient, type Event } from "@opencode-ai/sdk"
import { createSimpleContext } from "./helper"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { onCleanup } from "solid-js"

export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
  init: (props: { url: string; token?: string }) => {
    const abort = new AbortController()
    
    // Get current working directory to pass as directory parameter
    const directory = process.cwd()
    
    // Get token from environment if not provided in props
    const token = props.token || process.env.OPENCODE_TOKEN
    
    const sdk = createOpencodeClient({
      baseUrl: props.url,
      signal: abort.signal,
      headers: token ? {
        Authorization: `Bearer ${token}`
      } : undefined,
      fetch: (req) => {
        // @ts-ignore
        req.timeout = false
        
        // Add directory query parameter to all requests if not already present
        const url = new URL(req.url)
        if (!url.searchParams.has('directory')) {
          url.searchParams.set('directory', directory)
          return fetch(new Request(url.toString(), req))
        }
        
        return fetch(req)
      },
    })

    const emitter = createGlobalEmitter<{
      [key in Event["type"]]: Extract<Event, { type: key }>
    }>()

    // Subscribe to events with directory parameter
    sdk.event.subscribe({
      query: {
        directory,
      },
    }).then(async (events) => {
      for await (const event of events.stream) {
        console.log("event", event.type)
        emitter.emit(event.type, event)
      }
    })

    onCleanup(() => {
      abort.abort()
    })

    return { client: sdk, event: emitter }
  },
})
