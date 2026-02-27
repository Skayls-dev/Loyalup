import { useEffect, useMemo, useState } from 'react'
import {
  createApiKey,
  createWebhook,
  deleteWebhook,
  listApiKeys,
  listWebhooks,
  revokeApiKey,
  rotateApiKey,
  rotateWebhookSecret,
  type ProviderApiKey,
  type ProviderWebhook,
} from '../services/developerPlatformService'

const availableScopes = ['read', 'write', 'transactions', 'clients', 'webhooks']
const webhookEvents = [
  'client.created',
  'client.updated',
  'service.created',
  'service.updated',
  'transaction.created',
  'transaction.validated',
  'promotion.created',
  'promotion.updated',
]

const secondaryButtonClass =
  'rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60'

export function DeveloperPortal() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [apiKeys, setApiKeys] = useState<ProviderApiKey[]>([])
  const [webhooks, setWebhooks] = useState<ProviderWebhook[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyEnv, setNewKeyEnv] = useState<'sandbox' | 'production'>('sandbox')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read'])
  const [createdKey, setCreatedKey] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['transaction.validated'])

  const hasWebhooks = webhooks.length > 0
  const hasApiKeys = apiKeys.length > 0

  const docsBaseUrl = useMemo(() => '/docs/sdk.md', [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setStatus('')
      try {
        const [keys, hooks] = await Promise.all([listApiKeys(), listWebhooks()])
        setApiKeys(keys)
        setWebhooks(hooks)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to load developer portal')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const refresh = async () => {
    const [keys, hooks] = await Promise.all([listApiKeys(), listWebhooks()])
    setApiKeys(keys)
    setWebhooks(hooks)
  }

  const createKeyAction = async () => {
    if (newKeyName.trim().length < 2) {
      setStatus('Nom de clé invalide')
      return
    }

    try {
      const data = await createApiKey({
        name: newKeyName.trim(),
        environment: newKeyEnv,
        scopes: selectedScopes,
      })
      setCreatedKey(data.key)
      setNewKeyName('')
      setStatus('Clé API créée')
      await refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create key')
    }
  }

  const createWebhookAction = async () => {
    if (!webhookUrl.startsWith('https://')) {
      setStatus('URL webhook doit commencer par https://')
      return
    }

    try {
      await createWebhook(webhookUrl.trim(), selectedEvents)
      setWebhookUrl('')
      setStatus('Webhook créé')
      await refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create webhook')
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs text-zinc-500">Chargement...</p>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">Developer Portal</h3>
        <div className="flex items-center gap-2 text-xs">
          <a href="/docs/openapi.yaml" target="_blank" rel="noreferrer" className={secondaryButtonClass}>
            OpenAPI
          </a>
          <a href={docsBaseUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
            SDK Docs
          </a>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <p className="text-xs font-semibold text-zinc-300">Créer une clé API</p>
        <div className="grid gap-2 md:grid-cols-4">
          <input
            value={newKeyName}
            onChange={(event) => setNewKeyName(event.target.value)}
            placeholder="Nom de clé"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100"
          />
          <select
            value={newKeyEnv}
            onChange={(event) => setNewKeyEnv(event.target.value as 'sandbox' | 'production')}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100"
          >
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
          <button
            type="button"
            onClick={() => {
              void createKeyAction()
            }}
            className="rounded-md bg-zinc-100 px-2 py-2 text-xs font-semibold text-zinc-900"
          >
            Générer
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableScopes.map((scope) => {
            const active = selectedScopes.includes(scope)
            return (
              <button
                key={scope}
                type="button"
                onClick={() => {
                  setSelectedScopes((prev) =>
                    prev.includes(scope) ? prev.filter((value) => value !== scope) : [...prev, scope],
                  )
                }}
                className={`rounded-md px-2 py-1 text-xs ${active ? 'bg-zinc-100 text-zinc-900' : 'border border-zinc-700 text-zinc-300'}`}
              >
                {scope}
              </button>
            )
          })}
        </div>

        {createdKey ? (
          <div className="rounded-md border border-emerald-900/60 bg-emerald-950/40 p-2 text-xs text-emerald-200">
            <p className="font-semibold">Copiez cette clé maintenant (affichée une seule fois)</p>
            <p className="mt-1 break-all">{createdKey}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-300">Clés API</p>
        {!hasApiKeys ? <p className="text-xs text-zinc-500">Aucune clé API</p> : null}
        {apiKeys.map((key) => (
          <article key={key.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
            <div>
              <p className="text-xs font-medium text-zinc-100">{key.name}</p>
              <p className="text-xs text-zinc-500">{key.environment} • {key.key_prefix}...</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void rotateApiKey(key.id, key.name)
                    .then((result) => {
                      setCreatedKey(result.key)
                      setStatus('Clé rotatée')
                      return refresh()
                    })
                    .catch((error) => {
                      setStatus(error instanceof Error ? error.message : 'Rotation failed')
                    })
                }}
                className={secondaryButtonClass}
              >
                Rotate
              </button>
              <button
                type="button"
                onClick={() => {
                  void revokeApiKey(key.id)
                    .then(() => {
                      setStatus('Clé révoquée')
                      return refresh()
                    })
                    .catch((error) => {
                      setStatus(error instanceof Error ? error.message : 'Revoke failed')
                    })
                }}
                className={secondaryButtonClass}
              >
                Revoke
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <p className="text-xs font-semibold text-zinc-300">Créer un webhook</p>
        <div className="grid gap-2 md:grid-cols-4">
          <input
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://your-domain.com/webhooks"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 md:col-span-3"
          />
          <button
            type="button"
            onClick={() => {
              void createWebhookAction()
            }}
            className="rounded-md bg-zinc-100 px-2 py-2 text-xs font-semibold text-zinc-900"
          >
            Créer
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {webhookEvents.map((eventName) => {
            const active = selectedEvents.includes(eventName)
            return (
              <button
                key={eventName}
                type="button"
                onClick={() => {
                  setSelectedEvents((prev) =>
                    prev.includes(eventName)
                      ? prev.filter((value) => value !== eventName)
                      : [...prev, eventName],
                  )
                }}
                className={`rounded-md px-2 py-1 text-xs ${active ? 'bg-zinc-100 text-zinc-900' : 'border border-zinc-700 text-zinc-300'}`}
              >
                {eventName}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-300">Webhooks</p>
        {!hasWebhooks ? <p className="text-xs text-zinc-500">Aucun webhook</p> : null}
        {webhooks.map((hook) => (
          <article key={hook.id} className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-zinc-100">{hook.url}</p>
                <p className="text-xs text-zinc-500">{hook.events.join(', ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void rotateWebhookSecret(hook.id)
                      .then((result) => {
                        setStatus(`Secret rotaté: ${result.secret}`)
                      })
                      .catch((error) => setStatus(error instanceof Error ? error.message : 'Rotate failed'))
                  }}
                  className={secondaryButtonClass}
                >
                  Rotate secret
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteWebhook(hook.id)
                      .then(() => {
                        setStatus('Webhook supprimé')
                        return refresh()
                      })
                      .catch((error) => setStatus(error instanceof Error ? error.message : 'Delete failed'))
                  }}
                  className={secondaryButtonClass}
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">Failures: {hook.failure_count}</p>
          </article>
        ))}
      </div>

      {status ? <p className="text-xs text-zinc-400">{status}</p> : null}
    </section>
  )
}
