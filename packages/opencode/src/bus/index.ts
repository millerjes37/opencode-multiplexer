import z from "zod"
import type { ZodType } from "zod"
import { Log } from "../util/log"
import { Instance } from "../project/instance"

export namespace Bus {
  const log = Log.create({ service: "bus" })
  type Subscription = (event: any) => void

  // Global state keyed by projectID instead of per-instance
  interface BusState {
    subscriptions: Map<any, Subscription[]>
    messageCount: number
  }

  const globalBusMap = new Map<string, BusState>()

  function getBusForProject(projectID: string): BusState {
    if (!globalBusMap.has(projectID)) {
      globalBusMap.set(projectID, {
        subscriptions: new Map(),
        messageCount: 0,
      })
    }
    return globalBusMap.get(projectID)!
  }

  export type EventDefinition = ReturnType<typeof event>

  const registry = new Map<string, EventDefinition>()

  export function event<Type extends string, Properties extends ZodType>(type: Type, properties: Properties) {
    const result = {
      type,
      properties,
    }
    registry.set(type, result)
    return result
  }

  export function payloads() {
    return z.discriminatedUnion(
      "type",
      registry
        .entries()
        .map(([type, def]) => {
          return z
            .object({
              type: z.literal(type),
              properties: def.properties,
            })
            .meta({
              ref: "Event" + "." + def.type,
            })
        })
        .toArray() as any,
    )
  }

  export async function publish<Definition extends EventDefinition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ) {
    const projectID = Instance.project.id
    const payload = {
      type: def.type,
      properties: {
        ...(properties as object),
        projectID,
      },
    }
    log.info("publishing", {
      type: def.type,
      projectID,
    })
    const busState = getBusForProject(projectID)
    busState.messageCount++
    const pending = []
    for (const key of [def.type, "*"]) {
      const match = busState.subscriptions.get(key)
      for (const sub of match ?? []) {
        pending.push(sub(payload))
      }
    }
    return Promise.all(pending)
  }

  export function subscribe<Definition extends EventDefinition>(
    def: Definition,
    callback: (event: { type: Definition["type"]; properties: z.infer<Definition["properties"]> }) => void,
  ) {
    return raw(def.type, callback)
  }

  export function once<Definition extends EventDefinition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => "done" | undefined,
  ) {
    const unsub = subscribe(def, (event) => {
      if (callback(event)) unsub()
    })
  }

  export function subscribeAll(callback: (event: any) => void) {
    return raw("*", callback)
  }

  function raw(type: string, callback: (event: any) => void) {
    const projectID = Instance.project.id
    log.info("subscribing", { type, projectID })
    const busState = getBusForProject(projectID)
    const subscriptions = busState.subscriptions
    let match = subscriptions.get(type) ?? []
    match.push(callback)
    subscriptions.set(type, match)

    return () => {
      log.info("unsubscribing", { type, projectID })
      const busState = getBusForProject(projectID)
      const subscriptions = busState.subscriptions
      const match = subscriptions.get(type)
      if (!match) return
      const index = match.indexOf(callback)
      if (index === -1) return
      match.splice(index, 1)
    }
  }

  /**
   * Cleanup function to remove all subscriptions for a project
   * Should be called when a project instance is disposed
   */
  export function cleanup(projectID: string) {
    log.info("cleaning up bus for project", { projectID })
    globalBusMap.delete(projectID)
  }
}
