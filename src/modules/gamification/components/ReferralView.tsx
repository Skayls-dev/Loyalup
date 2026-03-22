import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Award, Zap, Star, Gift } from 'lucide-react'
import { useReferral, useReferrerTier } from '../hooks'

interface ReferralViewProps {
  language?: string
}

function ChannelIcon({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">{children}</span>
}

export function ReferralView({ language = 'fr' }: ReferralViewProps) {
  const { referralStats, loading, error, generateLink } = useReferral()
  const { tier } = useReferrerTier()
  const [copied, setCopied] = useState(false)

  const shareText = 'Rejoignez-moi sur LoyalUp et gagnez un bonus de bienvenue.'

  const shareToWhatsApp = () => {
    if (!referralStats?.url) return
    const text = encodeURIComponent(`${shareText} ${referralStats.url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const shareToFacebook = () => {
    if (!referralStats?.url) return
    const url = encodeURIComponent(referralStats.url)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer')
  }

  const shareToTelegram = () => {
    if (!referralStats?.url) return
    const url = encodeURIComponent(referralStats.url)
    const text = encodeURIComponent(shareText)
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const shareToMessenger = () => {
    if (!referralStats?.url) return
    const url = encodeURIComponent(referralStats.url)
    window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=87741124305&redirect_uri=${url}`, '_blank', 'noopener,noreferrer')
  }

  const shareToX = () => {
    if (!referralStats?.url) return
    const text = encodeURIComponent(shareText)
    const url = encodeURIComponent(referralStats.url)
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer')
  }

  const shareBySms = () => {
    if (!referralStats?.url) return
    const body = encodeURIComponent(`${shareText} ${referralStats.url}`)
    window.location.href = `sms:?&body=${body}`
  }

  const shareByEmail = () => {
    if (!referralStats?.url) return
    const subject = encodeURIComponent('Invitation LoyalUp')
    const body = encodeURIComponent(`${shareText}\n\n${referralStats.url}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleCopy = () => {
    if (referralStats?.url) {
      navigator.clipboard.writeText(referralStats.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleGenerate = async () => {
    try {
      await generateLink()
    } catch (err) {
      console.error('Failed to generate referral link:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Tier Badge */}
      {tier && (
        <div className={`rounded-2xl border p-4 shadow-sm shadow-slate-900/5 ${
          tier.current_tier === 1 ? 'border-slate-300 bg-slate-50' :
          tier.current_tier === 2 ? 'border-blue-300 bg-blue-50' :
          tier.current_tier === 3 ? 'border-purple-300 bg-purple-50' :
          tier.current_tier === 4 ? 'border-amber-300 bg-amber-50' :
          'border-emerald-300 bg-emerald-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {tier.current_tier === 1 && <Award className="w-5 h-5 text-slate-600" />}
              {tier.current_tier === 2 && <Award className="w-5 h-5 text-blue-600" />}
              {tier.current_tier === 3 && <Zap className="w-5 h-5 text-purple-600" />}
              {tier.current_tier === 4 && <Star className="w-5 h-5 text-amber-600" />}
              {tier.current_tier === 5 && <Gift className="w-5 h-5 text-emerald-600" />}
              <div>
                <p className={`text-sm font-bold ${
                  tier.current_tier === 1 ? 'text-slate-900' :
                  tier.current_tier === 2 ? 'text-blue-900' :
                  tier.current_tier === 3 ? 'text-purple-900' :
                  tier.current_tier === 4 ? 'text-amber-900' :
                  'text-emerald-900'
                }`}>
                  Tier {tier.current_tier}: {tier.tier_name}
                </p>
                <p className={`text-xs ${
                  tier.current_tier === 1 ? 'text-slate-600' :
                  tier.current_tier === 2 ? 'text-blue-600' :
                  tier.current_tier === 3 ? 'text-purple-600' :
                  tier.current_tier === 4 ? 'text-amber-600' :
                  'text-emerald-600'
                }`}>
                  {tier.activated_count} filleuls · {tier.referrals_to_next > 0 ? `${tier.referrals_to_next} pour le suivant` : 'Max atteint'}
                </p>
              </div>
            </div>
            <Link
              to="/dashboard/referral/analytics"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
            >
              Voir →
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5">
        <h3 className="mb-2 text-lg font-bold text-slate-900">👥 Parrainez vos amis</h3>
        <p className="text-sm text-slate-600">
          Partagez votre lien perso: votre ami gagne un bonus a son premier achat valide, et vous aussi.
        </p>
      </div>

      {!referralStats ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Génération...' : '🎉 Générer Mon Code'}
        </button>
      ) : (
        <div className="space-y-4">
          {/* Code display */}
          <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5">
            <p className="mb-2 text-sm font-semibold text-slate-700">Votre code de parrainage</p>
            <div className="flex items-center justify-between rounded border border-indigo-200 bg-indigo-50 p-3">
              <code className="text-xl font-bold text-purple-600">
                {referralStats.code}
              </code>
              <button
                onClick={handleCopy}
                className="rounded bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                {copied ? '✅' : '📋'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Expire le {new Date(referralStats.expires_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-800">
                {referralStats.total_generated}
              </div>
              <p className="text-xs text-gray-600 font-semibold">Générés</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {referralStats.activated}
              </div>
              <p className="text-xs text-blue-700 font-semibold">Activés</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-600">
                {referralStats.rewarded}
              </div>
              <p className="text-xs text-emerald-700 font-semibold">Récompensés</p>
            </div>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ChannelIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </ChannelIcon>
              Copier
            </button>
            <button
              onClick={shareToWhatsApp}
              className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 py-2 font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <ChannelIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 2a10 10 0 0 0-8.79 14.78L2 22l5.37-1.18A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.07-1.11l-.29-.17-3.19.7.68-3.1-.19-.31A8 8 0 1 1 12 20Zm4.41-5.98c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.17-.7-.63-1.17-1.4-1.31-1.64-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
                </svg>
              </ChannelIcon>
              WhatsApp
            </button>
            <button
              onClick={shareToFacebook}
              className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-2 font-semibold text-blue-700 hover:bg-blue-100"
            >
              <ChannelIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11 10.13 11.93v-8.43H7.08v-3.5h3.05V9.41c0-3.03 1.79-4.71 4.53-4.71 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.5h-2.8V24C19.61 23.07 24 18.09 24 12.07Z" />
                </svg>
              </ChannelIcon>
              Facebook
            </button>
            <button
              onClick={shareToTelegram}
              className="flex items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 py-2 font-semibold text-cyan-700 hover:bg-cyan-100"
            >
              <ChannelIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M9.04 15.57 8.66 20c.55 0 .79-.24 1.08-.53l2.59-2.47 5.36 3.92c.98.54 1.67.26 1.93-.91l3.5-16.39h.01c.31-1.45-.52-2.01-1.47-1.65L1.1 9.93c-1.4.55-1.38 1.33-.24 1.68l5.26 1.64L18.33 5.6c.58-.38 1.11-.17.67.21" />
                </svg>
              </ChannelIcon>
              Telegram
            </button>
            <button
              onClick={shareByEmail}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ChannelIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </ChannelIcon>
              Email
            </button>
            <button
              onClick={shareToMessenger}
              className="flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 py-2 font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <ChannelIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.92 1.46 5.52 3.75 7.21V22l3.23-1.77c.94.26 1.95.4 3.02.4 5.52 0 10-4.15 10-9.27S17.52 2 12 2Zm1.01 12.44-2.54-2.71-4.94 2.71 5.43-5.76 2.58 2.71 4.89-2.71-5.42 5.76Z" />
                </svg>
              </ChannelIcon>
              Messenger
            </button>
            <button
              onClick={shareToX}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-100 py-2 font-semibold text-slate-800 hover:bg-slate-200"
            >
              <ChannelIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M18.9 2H22l-6.78 7.74L23.2 22h-6.25l-4.89-6.42L6.4 22H3.3l7.26-8.3L.8 2h6.36l4.41 5.82L18.9 2Zm-1.1 18h1.72L6.24 3.9H4.4L17.8 20Z" />
                </svg>
              </ChannelIcon>
              X (Twitter)
            </button>
            <button
              onClick={shareBySms}
              className="flex items-center justify-center gap-2 rounded-lg border border-lime-200 bg-lime-50 py-2 font-semibold text-lime-700 hover:bg-lime-100"
            >
              <ChannelIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              </ChannelIcon>
              SMS
            </button>
          </div>

          {/* Points earned */}
          {referralStats.points_earned > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm text-gray-700">Points gagnés par parrainages</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                +{referralStats.points_earned}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          <p>{error.message}</p>
          {error.message.toLowerCase().includes('session') ? (
            <Link to="/auth" className="mt-2 inline-flex text-sm font-semibold text-rose-800 underline underline-offset-2">
              Se reconnecter
            </Link>
          ) : null}
        </div>
      )}
    </div>
  )
}

