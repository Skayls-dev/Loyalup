import { createRoot, type Root } from 'react-dom/client'
import { Widget } from './Widget'

type DatasetWidgetElement = HTMLElement & {
  dataset: {
    fournisseurId?: string
    baseUrl?: string
  }
}

class LoyalupWidgetElement extends HTMLElement {
  static get observedAttributes() {
    return ['fournisseur-id', 'base-url']
  }

  private reactRoot: Root | null = null
  private mountNode: HTMLDivElement | null = null

  connectedCallback() {
    const shadowRoot = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    this.mountNode = this.mountNode ?? document.createElement('div')

    if (!this.mountNode.isConnected) {
      shadowRoot.appendChild(this.mountNode)
    }

    this.reactRoot = this.reactRoot ?? createRoot(this.mountNode)
    this.renderWidget()
  }

  disconnectedCallback() {
    this.reactRoot?.unmount()
    this.reactRoot = null
    this.mountNode = null
  }

  attributeChangedCallback() {
    this.renderWidget()
  }

  private renderWidget() {
    if (!this.reactRoot) {
      return
    }

    const fournisseurId = this.getAttribute('fournisseur-id')?.trim() ?? ''
    const baseUrl = this.getAttribute('base-url')?.trim() ?? ''

    if (!fournisseurId || !baseUrl) {
      this.reactRoot.render(
        <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#52525b' }}>
          LoyalUp widget: missing fournisseur-id or base-url attributes
        </div>,
      )
      return
    }

    this.reactRoot.render(<Widget fournisseurId={fournisseurId} baseUrl={baseUrl} />)
  }
}

if (!customElements.get('loyalup-widget')) {
  customElements.define('loyalup-widget', LoyalupWidgetElement)
}

for (const element of document.querySelectorAll('[data-loyalup-widget]')) {
  const host = element as DatasetWidgetElement
  const fournisseurId = host.dataset.fournisseurId
  const baseUrl = host.dataset.baseUrl

  const widget = document.createElement('loyalup-widget')
  if (fournisseurId) {
    widget.setAttribute('fournisseur-id', fournisseurId)
  }
  if (baseUrl) {
    widget.setAttribute('base-url', baseUrl)
  }

  host.replaceWith(widget)
}
