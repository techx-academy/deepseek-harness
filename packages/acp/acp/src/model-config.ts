/** ACP session model configuration projected from one adapter-owned catalog. @module */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionConfigOption } from '@agentclientprotocol/sdk'
import { ReasoningEffortId, type LlmModelInfo } from '@deepseek-ai/dsh-llm'

/** Stable ACP identifier for the session-local model selector. */
export const MODEL_CONFIG_ID = 'model'

/** Validated, deployment-scoped model directory for one provider. */
export interface AcpModelCatalog {
  /** Provider route shared by every selectable model. */
  provider: string
  /** Model selected when a new session is created. */
  initialModel: string
  /** Adapter-owned entries in adapter-preferred order. */
  models: readonly LlmModelInfo[]
  /** Exact model ids accepted by session/set_config_option. */
  modelIds: ReadonlySet<string>
  /** Validated adapter-owned effort selected together with each model. */
  reasoningDefaults: ReadonlyMap<string, ReasoningEffortId>
}

/**
 * Load and validate the one catalog used by every session on this bridge.
 * Catalog discovery is an initialization contract: an enabled selector never
 * boots empty and never advertises a default the adapter did not publish.
 * @param ctx - Bridge context carrying the injected LLM runtime.
 * @param provider - Deployment-owned provider route.
 * @param initialModel - Model selected for each new session.
 * @param reasoningDefaults - Deployment-owned model defaults; omission leaves provider behavior.
 * @returns the detached, validated catalog and exact accepted model ids.
 */
export async function loadAcpModelCatalog(
  ctx: Context,
  provider: string | undefined,
  initialModel: string | undefined,
  reasoningDefaults: Readonly<Record<string, string>> = {},
): Promise<AcpModelCatalog> {
  if (provider === undefined || initialModel === undefined) {
    throw new Error('ACP model selection requires both provider and model')
  }
  const models = await ctx.llm.listModels(provider)
  if (models.length === 0) {
    throw new Error(`ACP model selection requires a non-empty catalog for provider "${provider}"`)
  }
  const modelIds = new Set(models.map(model => model.id))
  if (!modelIds.has(initialModel)) {
    throw new Error(`ACP default model "${initialModel}" is absent from provider "${provider}"`)
  }
  const defaults = new Map<string, ReasoningEffortId>()
  for (const [model, effort] of Object.entries(reasoningDefaults)) {
    if (!modelIds.has(model)) {
      throw new Error(`ACP reasoning default names unknown model "${model}"`)
    }
    const resolved = await ctx.llm.resolveModelInfo(provider, model)
    if (!resolved.reasoning?.efforts.some(candidate => candidate.id === effort)) {
      throw new Error(`ACP model "${model}" does not support reasoning effort "${effort}"`)
    }
    defaults.set(model, ReasoningEffortId(effort))
  }
  return { provider, initialModel, models, modelIds, reasoningDefaults: defaults }
}

/**
 * Project the complete current ACP session configuration.
 * @param catalog - Validated provider catalog projected by this bridge.
 * @param currentModel - Exact session-local selected model id.
 * @returns one standard ACP model select option.
 */
export function modelConfigOptions(catalog: AcpModelCatalog, currentModel: string): SessionConfigOption[] {
  return [{
    id: MODEL_CONFIG_ID,
    name: 'Model',
    description: 'Model used by this session.',
    category: 'model',
    type: 'select',
    currentValue: currentModel,
    options: catalog.models.map(model => ({
      value: model.id,
      name: model.name,
      ...model.description === undefined ? {} : { description: model.description },
    })),
  }]
}
