import type { ConsentType } from '../types'

export type SupportedLocale = 'fr' | 'en' | 'ar' | 'es' | 'nl'

type LocalizedText = Record<SupportedLocale, string>

type ConsentPolicyItem = {
  required: boolean
  title: LocalizedText
  description: LocalizedText
}

export const CURRENT_POLICY_VERSION = '1.0.0'

export const CONSENT_TYPES: Record<ConsentType, ConsentPolicyItem> = {
  essential: {
    required: true,
    title: {
      fr: 'Fonctionnement essentiel',
      en: 'Essential operation',
      ar: 'تشغيل أساسي',
      es: 'Funcionamiento esencial',
      nl: 'Essentiële werking',
    },
    description: {
      fr: 'Nécessaire au fonctionnement de LoyalUp (authentification, sécurité, synchronisation).',
      en: 'Required for LoyalUp core operation (authentication, security, synchronization).',
      ar: 'ضروري لعمل LoyalUp الأساسي (المصادقة، الأمان، المزامنة).',
      es: 'Necesario para el funcionamiento básico de LoyalUp (autenticación, seguridad, sincronización).',
      nl: 'Nodig voor de kernwerking van LoyalUp (authenticatie, beveiliging, synchronisatie).',
    },
  },
  analytics: {
    required: false,
    title: {
      fr: 'Amélioration du service',
      en: 'Service improvement',
      ar: 'تحسين الخدمة',
      es: 'Mejora del servicio',
      nl: 'Serviceverbetering',
    },
    description: {
      fr: 'Nous aide à comprendre l’utilisation pour améliorer l’app et les parcours.',
      en: 'Helps us understand usage to improve the app and user journeys.',
      ar: 'يساعدنا على فهم الاستخدام لتحسين التطبيق ومسارات المستخدم.',
      es: 'Nos ayuda a comprender el uso para mejorar la app y la experiencia.',
      nl: 'Helpt ons gebruik te begrijpen om app en gebruikersflows te verbeteren.',
    },
  },
  marketing: {
    required: false,
    title: {
      fr: 'Promotions personnalisées',
      en: 'Personalised offers',
      ar: 'عروض مخصصة',
      es: 'Promociones personalizadas',
      nl: 'Gepersonaliseerde aanbiedingen',
    },
    description: {
      fr: 'Recevoir des offres adaptées à vos habitudes et préférences.',
      en: 'Receive offers adapted to your habits and preferences.',
      ar: 'تلقي عروض تتناسب مع عاداتك وتفضيلاتك.',
      es: 'Recibir ofertas adaptadas a tus hábitos y preferencias.',
      nl: 'Ontvang aanbiedingen afgestemd op je gewoonten en voorkeuren.',
    },
  },
  third_party: {
    required: false,
    title: {
      fr: 'Partage anonymisé',
      en: 'Anonymous sharing',
      ar: 'مشاركة مجهولة',
      es: 'Compartición anónima',
      nl: 'Geanonimiseerde deling',
    },
    description: {
      fr: 'Partage de données agrégées et anonymisées pour analyses partenaires.',
      en: 'Share aggregated and anonymised data for partner analytics.',
      ar: 'مشاركة بيانات مجمعة ومجهولة لتحليلات الشركاء.',
      es: 'Compartir datos agregados y anonimizados para análisis de socios.',
      nl: 'Delen van geaggregeerde en geanonimiseerde data voor partneranalyses.',
    },
  },
}

export const CONSENT_TYPE_LIST = Object.keys(CONSENT_TYPES) as ConsentType[]
