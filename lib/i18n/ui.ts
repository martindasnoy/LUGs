export const uiLanguages = ["es", "en"] as const;

export type UiLanguage = (typeof uiLanguages)[number];

export const uiLanguageLabels: Record<UiLanguage, string> = {
  es: "Espanol",
  en: "English",
};

type UiDictionary = {
  appAccessTitle: string;
  register: string;
  login: string;
  email: string;
  password: string;
  processing: string;
  createAccount: string;
  signIn: string;
  missingEnv: string;
  accountCreated: string;
  errorPrefix: string;
  settingsAria: string;
  settingsTitle: string;
  logout: string;
  language: string;
};

export const uiTranslations: Record<UiLanguage, UiDictionary> = {
  es: {
    appAccessTitle: "LUGs App - Acceso",
    register: "Registro",
    login: "Login",
    email: "Email",
    password: "Contrasena",
    processing: "Procesando...",
    createAccount: "Crear cuenta",
    signIn: "Iniciar sesion",
    missingEnv: "Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    accountCreated: "Cuenta creada. Revisa tu email para confirmar.",
    errorPrefix: "Error",
    settingsAria: "Configuracion de usuario",
    settingsTitle: "Configuracion de usuario",
    logout: "Salir",
    language: "Idioma",
  },
  en: {
    appAccessTitle: "LUGs App - Access",
    register: "Sign up",
    login: "Login",
    email: "Email",
    password: "Password",
    processing: "Processing...",
    createAccount: "Create account",
    signIn: "Sign in",
    missingEnv: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    accountCreated: "Account created. Check your email to confirm.",
    errorPrefix: "Error",
    settingsAria: "User settings",
    settingsTitle: "User settings",
    logout: "Logout",
    language: "Language",
  },
};
