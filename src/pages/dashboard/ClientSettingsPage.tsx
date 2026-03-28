import { useMemo, useState } from 'react'
import { Shield, Sparkles, User } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button } from '../../components/ui'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { SettingsTabsShell } from '../../shared/components/SettingsTabsShell'
import { supabase } from '../../shared/lib/supabaseClient'

type ClientSettingsTab = 'profile' | 'security' | 'shortcuts'

const clientSettingsTabs: Array<{
  id: ClientSettingsTab
  label: string
  description: string
  icon: typeof User
}> = [
  {
    id: 'profile',
    label: 'Profil',
    description: 'Informations personnelles, avatar et identité.',
    icon: User,
  },
  {
    id: 'security',
    label: 'Sécurité',
    description: 'Mot de passe, session et contrôle d’accès.',
    icon: Shield,
  },
  {
    id: 'shortcuts',
    label: 'Raccourcis',
    description: 'Accès rapides vers vos usages fréquents.',
    icon: Sparkles,
  },
]

const settingsShellClass = 'rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_22px_60px_-46px_rgba(17,24,39,0.32)]'
const settingsPanelClass = 'rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_18px_52px_-42px_rgba(17,24,39,0.24)]'
const settingsAsideClass = 'rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_18px_52px_-42px_rgba(17,24,39,0.24)]'

const PROFILE_PHOTOS_BUCKET = 'profile-photos'

const avatars = [
  { id: 'lion', emoji: '🦁', label: 'Lion', gradient: 'linear-gradient(135deg, #FFE3A3, #FFB86B)' },
  { id: 'leopard', emoji: '🐆', label: 'Léopard', gradient: 'linear-gradient(135deg, #FFD6C2, #FF9A8B)' },
  { id: 'eagle', emoji: '🦅', label: 'Aigle', gradient: 'linear-gradient(135deg, #CBE8FF, #8EC5FC)' },
  { id: 'flower', emoji: '🌺', label: 'Fleur', gradient: 'linear-gradient(135deg, #F8D7FF, #C9A9FF)' },
] as const

const countries = ['Belgique', 'France', 'Pays-Bas', 'Luxembourg'] as const

function formatJoinedAt(value?: string | null): string {
  if (!value) {
    return 'Non renseigne'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Non renseigne'
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function ClientSettingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, updatePassword, logout, loading, error, hydrateCurrentUser } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const shortcutButtonClass = 'justify-start hover:bg-indigo-50 hover:border-primary/30 hover:text-primary'

  // Profile edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editNom, setEditNom] = useState('')
  const [editPrenom, setEditPrenom] = useState('')
  const [editAvatarId, setEditAvatarId] = useState<string>('lion')
  const [editPhotoUrl, setEditPhotoUrl] = useState<string>('')
  const [editCity, setEditCity] = useState('')
  const [editCountry, setEditCountry] = useState<(typeof countries)[number]>('Belgique')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [profileEditError, setProfileEditError] = useState<string | null>(null)
  const [profileEditSuccess, setProfileEditSuccess] = useState<string | null>(null)
  const requestedTab = searchParams.get('tab')
  const activeTab: ClientSettingsTab = clientSettingsTabs.some((tab) => tab.id === requestedTab)
    ? (requestedTab as ClientSettingsTab)
    : 'profile'
  const activeTabMeta = clientSettingsTabs.find((tab) => tab.id === activeTab) ?? clientSettingsTabs[0]

  const selectTab = (tab: ClientSettingsTab) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tab)
    setSearchParams(nextParams, { replace: true })
  }

  const openEdit = () => {
    setEditNom(profile?.nom?.trim() ?? '')
    setEditPrenom(profile?.prenom?.trim() ?? '')
    const currentAvatar = profile?.avatar_id ?? 'lion'
    setEditAvatarId(avatars.some((a) => a.id === currentAvatar) ? currentAvatar : 'lion')
    setEditPhotoUrl(profile?.avatar_url?.trim() ?? '')
    const currentCountry = (profile?.country ?? 'Belgique') as (typeof countries)[number]
    setEditCountry(countries.includes(currentCountry) ? currentCountry : 'Belgique')
    setEditCity(profile?.city?.trim() ?? profile?.ville?.trim() ?? '')
    setProfileEditError(null)
    setProfileEditSuccess(null)
    setIsEditing(true)
  }

  const handlePhotoUpload = async (file: File) => {
    if (!user?.id) {
      setProfileEditError('Utilisateur non authentifie.')
      return
    }

    const maxSize = 4 * 1024 * 1024
    if (file.size > maxSize) {
      setProfileEditError('La photo depasse 4 Mo.')
      return
    }

    if (!file.type.startsWith('image/')) {
      setProfileEditError('Seuls les fichiers image sont autorises.')
      return
    }

    setIsUploadingPhoto(true)
    setProfileEditError(null)

    try {
      const extension = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`
      const upload = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

      if (upload.error) throw upload.error

      const { data } = supabase.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(path)
      if (!data?.publicUrl) {
        throw new Error('URL de la photo introuvable.')
      }

      setEditPhotoUrl(data.publicUrl)
    } catch (err) {
      setProfileEditError(err instanceof Error ? err.message : 'Impossible de televerser la photo.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleProfileSave = async () => {
    const trimmedNom = editNom.trim()
    if (!trimmedNom) {
      setProfileEditError('Le nom est requis.')
      return
    }

    setIsSaving(true)
    setProfileEditError(null)
    setProfileEditSuccess(null)

    try {
      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          ...(user?.user_metadata ?? {}),
          nom: trimmedNom,
          prenom: editPrenom.trim() || null,
          avatar_id: editAvatarId,
          avatar_url: editPhotoUrl.trim() || null,
          city: editCity.trim() || null,
          ville: editCity.trim() || null,
          country: editCountry,
        },
      })

      if (metaError) throw metaError

      if (user?.id) {
        const { error: dbError } = await supabase
          .from('profiles')
          .update({ nom: trimmedNom })
          .eq('id', user.id)

        if (dbError) throw dbError
      }

      await hydrateCurrentUser()
      setProfileEditSuccess('Profil mis à jour avec succès.')
      setIsEditing(false)
    } catch (err) {
      setProfileEditError(err instanceof Error ? err.message : 'Impossible de sauvegarder le profil.')
    } finally {
      setIsSaving(false)
    }
  }

  const displayName = useMemo(() => {
    const fullName = [profile?.prenom?.trim(), profile?.nom?.trim()].filter(Boolean).join(' ').trim()
    if (fullName) {
      return fullName
    }

    return profile?.nom?.trim() || user?.email?.split('@')[0] || 'Membre Looyaal'
  }, [profile?.nom, profile?.prenom, user?.email])

  const handlePasswordSubmit = async () => {
    setLocalError(null)
    setSuccessMessage(null)

    if (password.trim().length < 8) {
      setLocalError('Le mot de passe doit contenir au moins 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setLocalError('La confirmation du mot de passe ne correspond pas.')
      return
    }

    try {
      await updatePassword(password)
      setPassword('')
      setConfirmPassword('')
      setSuccessMessage('Mot de passe mis a jour avec succes.')
    } catch {
      return
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  const renderProfileTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
      <section className={settingsPanelClass}>
        <div className="flex items-center justify-between">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Profil</p>
          {!isEditing && (
            <button
              type="button"
              onClick={openEdit}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
            >
              Modifier
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Photo de profil</p>
              <div className="flex flex-wrap items-center gap-3">
                {editPhotoUrl ? (
                  <img
                    src={editPhotoUrl}
                    alt="Photo de profil"
                    className="h-14 w-14 rounded-xl border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-lg text-gray-400">
                    +
                  </div>
                )}

                <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary/40 hover:text-primary">
                  {isUploadingPhoto ? 'Upload...' : 'Choisir une photo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={isUploadingPhoto || isSaving}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void handlePhotoUpload(file)
                      }
                      event.currentTarget.value = ''
                    }}
                  />
                </label>

                {editPhotoUrl ? (
                  <button
                    type="button"
                    onClick={() => setEditPhotoUrl('')}
                    disabled={isSaving || isUploadingPhoto}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Retirer
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-gray-500">Formats supportes: JPG, PNG, WEBP. Taille max 4 Mo.</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Avatar</p>
              <div className="flex flex-wrap gap-2">
                {avatars.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    title={a.label}
                    onClick={() => setEditAvatarId(a.id)}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl transition-all ${
                      editAvatarId === a.id
                        ? 'scale-110 ring-2 ring-primary ring-offset-2'
                        : 'border border-gray-200 hover:border-primary/40'
                    }`}
                    style={{ background: a.gradient }}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-prenom" className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  Prénom
                </label>
                <input
                  id="edit-prenom"
                  type="text"
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="Votre prénom"
                />
              </div>
              <div>
                <label htmlFor="edit-nom" className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-nom"
                  type="text"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="Votre nom"
                />
              </div>
              <div>
                <label htmlFor="edit-city" className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  Ville
                </label>
                <input
                  id="edit-city"
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="Votre ville"
                />
              </div>
              <div>
                <label htmlFor="edit-country" className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  Pays
                </label>
                <select
                  id="edit-country"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value as (typeof countries)[number])}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {profileEditError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{profileEditError}</p>
            )}

            <div className="flex gap-2">
              <Button loading={isSaving} onClick={() => void handleProfileSave()}>
                Sauvegarder
              </Button>
              <Button
                variant="soft"
                onClick={() => { setIsEditing(false); setProfileEditError(null) }}
                disabled={isSaving}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profile?.avatar_url?.trim() ? (
              <div className="col-span-full flex items-center gap-3">
                <img
                  src={profile.avatar_url}
                  alt="Photo de profil"
                  className="h-14 w-14 rounded-xl border border-gray-200 object-cover"
                />
              </div>
            ) : profile?.avatar_id && avatars.some((a) => a.id === profile.avatar_id) ? (
              <div className="col-span-full flex items-center gap-3">
                {(() => {
                  const av = avatars.find((a) => a.id === profile.avatar_id)
                  return av ? (
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                      style={{ background: av.gradient }}
                    >
                      {av.emoji}
                    </span>
                  ) : null
                })()}
              </div>
            ) : null}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Nom</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{displayName}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Email</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{user?.email ?? 'Non renseigne'}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Ville</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">
                {profile?.city?.trim() || profile?.ville?.trim() || 'Non renseigné'}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Pays</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">
                {profile?.country?.trim() || 'Non renseigné'}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Role</p>
              <p className="mt-2 font-body text-sm font-semibold capitalize text-dark">{profile?.role ?? 'client'}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Membre depuis</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{formatJoinedAt(profile?.created_at)}</p>
            </div>
          </div>
        )}

        {profileEditSuccess && !isEditing && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{profileEditSuccess}</p>
        )}
      </section>

      <aside className={settingsAsideClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Aperçu</p>
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
            <p className="text-sm font-semibold text-sky-900">Compte personnel</p>
            <p className="mt-1 text-sm text-sky-800">Vos informations de profil et vos accès sont regroupés ici pour éviter une page trop dense.</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-dark">Identité affichée</p>
            <p className="mt-1 text-sm text-gray-600">Le nom et l’avatar choisis sont repris dans vos vues client quand ils sont disponibles.</p>
          </div>
        </div>
      </aside>
    </div>
  )

  const renderSecurityTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className={settingsPanelClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Sécurité</p>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="client-password" className="mb-1 block text-sm text-gray-700">
              Nouveau mot de passe
            </label>
            <input
              id="client-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              placeholder="Minimum 8 caracteres"
            />
          </div>
          <div>
            <label htmlFor="client-password-confirm" className="mb-1 block text-sm text-gray-700">
              Confirmer le mot de passe
            </label>
            <input
              id="client-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              placeholder="Repetez le mot de passe"
            />
          </div>

          {localError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{localError}</p>
          ) : null}
          {successMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>
          ) : null}
          {error && !localError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <Button loading={loading} onClick={() => void handlePasswordSubmit()}>
            Mettre a jour le mot de passe
          </Button>
        </div>
      </section>

      <aside className={settingsAsideClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Session</p>
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="font-body text-sm font-semibold text-amber-900">Session active</p>
          <p className="mt-1 font-body text-sm text-amber-800">
            Deconnectez-vous si vous etes sur un appareil partage ou public.
          </p>
        </div>
        <Button className="mt-4" variant="soft" onClick={() => void handleLogout()} loading={loading}>
          Se deconnecter
        </Button>
      </aside>
    </div>
  )

  const renderShortcutsTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className={settingsPanelClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Raccourcis</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/history')}>
            Voir mon historique
          </Button>
          <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/rewards')}>
            Voir mes recompenses
          </Button>
          <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/networks')}>
            Gerer mes reseaux
          </Button>
          <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/scan')}>
            Scanner un QR
          </Button>
          <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/account-linking')}>
            Liaison compte partenaire
          </Button>
        </div>
      </section>

      <aside className={settingsAsideClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Conseil</p>
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-dark">Navigation rapide</p>
          <p className="mt-1 text-sm text-gray-600">
            Cette zone sert de hub léger pour retrouver vos parcours client sans mélanger profil et sécurité.
          </p>
        </div>
      </aside>
    </div>
  )

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'security':
        return renderSecurityTab()
      case 'shortcuts':
        return renderShortcutsTab()
      case 'profile':
      default:
        return renderProfileTab()
    }
  }

  return (
    <section className="space-y-6">
      <header className={settingsShellClass}>
        <h1 className="font-display text-3xl font-extrabold text-dark">Compte</h1>
        <p className="mt-2 font-body text-sm text-gray-600">
          Gerer votre profil, vos acces et la securite de votre session.
        </p>
      </header>

      <SettingsTabsShell
        sidebarEyebrow="Compte"
        sidebarTitle="Paramètres"
        sidebarHint="Séparez identité, sécurité et navigation rapide pour rendre la page plus claire sur mobile comme sur desktop."
        navAriaLabel="Tabs paramètres client"
        tabs={clientSettingsTabs}
        activeTab={activeTab}
        onSelectTab={selectTab}
        theme="client"
        sidebarFooter={(
          <div className="mt-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Conseil</p>
            <p className="mt-2 text-sm text-gray-600">
              Gardez cette séparation par onglets pour éviter les écrans trop longs et améliorer la lisibilité des actions.
            </p>
          </div>
        )}
        activeSectionClassName={settingsShellClass}
        activeTitle={activeTabMeta.label}
        activeDescription={activeTabMeta.description}
        activeBadge={(
          <Badge variant={activeTab === 'security' ? 'default' : 'info'}>
            {activeTab === 'profile' ? 'Profil' : activeTab === 'security' ? 'Accès' : 'Actions rapides'}
          </Badge>
        )}
      >
        {renderActiveTab()}
      </SettingsTabsShell>
    </section>
  )
}
