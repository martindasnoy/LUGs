"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabase/client";
import { type UiLanguage, uiLanguageLabels, uiLanguages, uiTranslations } from "@/lib/i18n/ui";

type Mode = "login" | "register";
type SocialPlatform = "instagram" | "facebook" | "";

type MasterLugItem = {
  lug_id: string;
  nombre: string;
  pais: string | null;
  logo_data_url: string | null;
  color1: string | null;
  members_count: number;
};

type LugMemberItem = {
  id: string;
  full_name: string;
  social_platform: string | null;
  social_handle: string | null;
};

type LugInfoItem = {
  lug_id: string;
  nombre: string;
  pais: string | null;
  descripcion: string | null;
  logo_data_url: string | null;
  color1: string | null;
  members: LugMemberItem[];
};

type AdminJoinRequestItem = {
  request_id: string;
  requester_id: string;
  lug_id: string;
  full_name: string;
  social_platform: string | null;
  social_handle: string | null;
  request_message: string | null;
  contact_social: string | null;
  created_at: string;
};

type RolLug = "admin" | "common" | null;

const FACE_TOTAL = 20;

export default function Home() {
  const supabase = getSupabaseClient();
  const [mode, setMode] = useState<Mode>("login");
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (typeof window === "undefined") {
      return "es";
    }

    const stored = window.localStorage.getItem("ui_language");
    return stored === "en" ? "en" : "es";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentLugId, setCurrentLugId] = useState<string | null>(null);
  const [rolLug, setRolLug] = useState<RolLug>(null);
  const [displayName, setDisplayName] = useState("Usuario");
  const [isMaster, setIsMaster] = useState(false);

  const [showUserSettings, setShowUserSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNameInput, setSettingsNameInput] = useState("");
  const [settingsEmailInput, setSettingsEmailInput] = useState("");
  const [settingsLanguageInput, setSettingsLanguageInput] = useState<UiLanguage>("es");
  const [settingsLugName, setSettingsLugName] = useState("Sin LUG");
  const [settingsLugId, setSettingsLugId] = useState<string | null>(null);
  const [settingsSocialPlatform, setSettingsSocialPlatform] = useState<SocialPlatform>("instagram");
  const [settingsSocialHandle, setSettingsSocialHandle] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState("");
  const [settingsPasswordConfirmInput, setSettingsPasswordConfirmInput] = useState("");
  const [selectedFace, setSelectedFace] = useState(1);
  const [showFacePicker, setShowFacePicker] = useState(false);
  const [previewFace, setPreviewFace] = useState(1);
  const [showMasterPanel, setShowMasterPanel] = useState(false);
  const [showLugsPanel, setShowLugsPanel] = useState(false);
  const [showCreateLugPanel, setShowCreateLugPanel] = useState(false);
  const [creatingLug, setCreatingLug] = useState(false);
  const [lugNombre, setLugNombre] = useState("");
  const [lugPais, setLugPais] = useState("");
  const [lugDescripcion, setLugDescripcion] = useState("");
  const [lugColor1, setLugColor1] = useState("#006eb2");
  const [lugColor2, setLugColor2] = useState("#ffffff");
  const [lugColor3, setLugColor3] = useState("#111111");
  const [lugLogoDataUrl, setLugLogoDataUrl] = useState<string | null>(null);
  const [lugLogoError, setLugLogoError] = useState("");
  const [masterLugs, setMasterLugs] = useState<MasterLugItem[]>([]);
  const [masterLugsLoading, setMasterLugsLoading] = useState(false);
  const [showSettingsLugPanel, setShowSettingsLugPanel] = useState(false);
  const [settingsLugPanelLoading, setSettingsLugPanelLoading] = useState(false);
  const [settingsLugSaving, setSettingsLugSaving] = useState(false);
  const [settingsLugNombreInput, setSettingsLugNombreInput] = useState("");
  const [settingsLugPaisInput, setSettingsLugPaisInput] = useState("");
  const [settingsLugDescripcionInput, setSettingsLugDescripcionInput] = useState("");
  const [settingsLugColor1Input, setSettingsLugColor1Input] = useState("#006eb2");
  const [settingsLugColor2Input, setSettingsLugColor2Input] = useState("#ffffff");
  const [settingsLugColor3Input, setSettingsLugColor3Input] = useState("#111111");
  const [settingsLugLogoDataUrl, setSettingsLugLogoDataUrl] = useState<string | null>(null);
  const [settingsLugLogoError, setSettingsLugLogoError] = useState("");
  const [showLugInfoPanel, setShowLugInfoPanel] = useState(false);
  const [lugInfoLoading, setLugInfoLoading] = useState(false);
  const [lugInfoData, setLugInfoData] = useState<LugInfoItem | null>(null);
  const [requestedLugIds, setRequestedLugIds] = useState<string[]>([]);
  const [requestActionLoadingLugId, setRequestActionLoadingLugId] = useState<string | null>(null);
  const [adminPendingRequestsCount, setAdminPendingRequestsCount] = useState(0);
  const [showAdminRequestsPanel, setShowAdminRequestsPanel] = useState(false);
  const [adminRequestsLoading, setAdminRequestsLoading] = useState(false);
  const [adminRequests, setAdminRequests] = useState<AdminJoinRequestItem[]>([]);
  const [showJoinRequestFormPanel, setShowJoinRequestFormPanel] = useState(false);
  const [joinRequestTargetLugId, setJoinRequestTargetLugId] = useState<string | null>(null);
  const [joinRequestTargetLugName, setJoinRequestTargetLugName] = useState("");
  const [joinRequestMessageInput, setJoinRequestMessageInput] = useState("");
  const [joinRequestSocialInput, setJoinRequestSocialInput] = useState("");
  const [joinRequestSending, setJoinRequestSending] = useState(false);
  const [showAdminRequestDetailPanel, setShowAdminRequestDetailPanel] = useState(false);
  const [selectedAdminRequest, setSelectedAdminRequest] = useState<AdminJoinRequestItem | null>(null);
  const [adminDecisionLoading, setAdminDecisionLoading] = useState(false);

  const t = useMemo(() => uiTranslations[language], [language]);
  const submitText = mode === "register" ? t.createAccount : t.signIn;
  const currentUserLug = useMemo(
    () => masterLugs.find((lug) => lug.lug_id === currentLugId) ?? null,
    [masterLugs, currentLugId],
  );
  const otherLugs = useMemo(
    () => masterLugs.filter((lug) => lug.lug_id !== currentLugId),
    [masterLugs, currentLugId],
  );

  function getFaceImagePath(faceNum: number) {
    return `/api/avatar/Cabeza_${String(faceNum).padStart(2, "0")}.png`;
  }

  function parseAvatarFace(avatarKey: string | null | undefined) {
    const raw = String(avatarKey ?? "");
    const maybe = Number(raw.replace("Cabeza_", "").replace(".png", ""));
    return Number.isFinite(maybe) && maybe >= 1 && maybe <= FACE_TOTAL ? maybe : 1;
  }

  function toColorPickerValue(value: string, fallback: string) {
    const normalized = String(value ?? "").trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : fallback;
  }

  function getContrastTextColor(backgroundColor: string | null | undefined) {
    const normalized = String(backgroundColor ?? "").trim();
    const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
    if (!isValidHex) {
      return "#111111";
    }

    const hex =
      normalized.length === 4
        ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
        : normalized;
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? "#111111" : "#ffffff";
  }

  const loadMyJoinRequests = useCallback(async (currentUserId: string) => {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("lug_join_requests")
      .select("lug_id")
      .eq("requester_id", currentUserId)
      .eq("status", "pending");

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    const pendingLugIds = (data ?? [])
      .map((row) => String(row.lug_id ?? "").trim())
      .filter((value) => value.length > 0);

    setRequestedLugIds(pendingLugIds);
  }, [supabase, t.errorPrefix]);

  const loadAdminPendingRequestsCount = useCallback(async (lugId: string) => {
    if (!supabase) {
      return;
    }

    const { count, error } = await supabase
      .from("lug_join_requests")
      .select("request_id", { count: "exact", head: true })
      .eq("lug_id", lugId)
      .eq("status", "pending");

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setAdminPendingRequestsCount(Number(count ?? 0));
  }, [supabase, t.errorPrefix]);

  const loadAdminPendingRequestsList = useCallback(async (lugId: string) => {
    if (!supabase) {
      return;
    }

    setAdminRequestsLoading(true);

    const { data, error } = await supabase.rpc("get_lug_pending_requests", {
      target_lug_id: lugId,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setAdminRequests([]);
      setAdminRequestsLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const parsed = rows.map((row) => ({
      request_id: String(row.request_id ?? ""),
      requester_id: String(row.requester_id ?? ""),
      lug_id: String(row.lug_id ?? ""),
      full_name: String(row.full_name ?? "Usuario"),
      social_platform: row.social_platform ? String(row.social_platform) : null,
      social_handle: row.social_handle ? String(row.social_handle) : null,
      request_message: row.request_message ? String(row.request_message) : null,
      contact_social: row.contact_social ? String(row.contact_social) : null,
      created_at: String(row.created_at ?? ""),
    }));

    setAdminRequests(parsed);
    setAdminRequestsLoading(false);
  }, [supabase, t.errorPrefix]);

  const ensureProfile = useCallback(async (currentUserId: string, currentEmail: string | null) => {
    if (!supabase) {
      return;
    }

    const fallbackUsername = String(currentEmail ?? "usuario").split("@")[0] || "usuario";
    await supabase.from("profiles").upsert(
      {
        id: currentUserId,
        username: fallbackUsername,
      },
      { onConflict: "id" },
    );
  }, [supabase]);

  const loadUserState = useCallback(async (currentUserId: string, currentEmail: string | null) => {
    if (!supabase) {
      return;
    }

    setUserId(currentUserId);
    setUserEmail(currentEmail);

    await ensureProfile(currentUserId, currentEmail);

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("full_name, avatar_key, preferred_language, is_master, current_lug_id, rol_lug")
      .eq("id", currentUserId)
      .maybeSingle();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    const fallbackName = String(currentEmail ?? "Usuario").split("@")[0] || "Usuario";
    const fullName = String(profileData?.full_name ?? "").trim();
    const lang = String(profileData?.preferred_language ?? "es");
    const face = parseAvatarFace(profileData?.avatar_key);
    const nextCurrentLugId = String(profileData?.current_lug_id ?? "").trim() || null;
    const nextRolLug = String(profileData?.rol_lug ?? "").trim();
    setIsMaster(Boolean(profileData?.is_master));
    setCurrentLugId(nextCurrentLugId);
    setRolLug(nextRolLug === "admin" ? "admin" : nextRolLug === "common" ? "common" : null);
    await loadMyJoinRequests(currentUserId);
    if (nextRolLug === "admin" && nextCurrentLugId) {
      await loadAdminPendingRequestsCount(nextCurrentLugId);
    } else {
      setAdminPendingRequestsCount(0);
    }

    setDisplayName(fullName || fallbackName);
    setSelectedFace(face);
    setPreviewFace(face);

    if (lang === "es" || lang === "en") {
      setLanguage(lang);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ui_language", lang);
      }
    }
  }, [ensureProfile, loadAdminPendingRequestsCount, loadMyJoinRequests, supabase, t.errorPrefix]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        await loadUserState(user.id, user.email ?? null);
      } else {
        setUserId(null);
        setUserEmail(null);
        setIsMaster(false);
        setCurrentLugId(null);
        setRolLug(null);
        setRequestedLugIds([]);
        setAdminPendingRequestsCount(0);
        setShowAdminRequestsPanel(false);
        setAdminRequests([]);
        setShowJoinRequestFormPanel(false);
        setJoinRequestTargetLugId(null);
        setJoinRequestTargetLugName("");
        setJoinRequestMessageInput("");
        setJoinRequestSocialInput("");
        setShowAdminRequestDetailPanel(false);
        setSelectedAdminRequest(null);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        void loadUserState(session.user.id, session.user.email ?? null);
      } else {
        setUserId(null);
        setUserEmail(null);
        setDisplayName("Usuario");
        setIsMaster(false);
        setCurrentLugId(null);
        setRolLug(null);
        setRequestedLugIds([]);
        setAdminPendingRequestsCount(0);
        setShowAdminRequestsPanel(false);
        setAdminRequests([]);
        setShowJoinRequestFormPanel(false);
        setJoinRequestTargetLugId(null);
        setJoinRequestTargetLugName("");
        setJoinRequestMessageInput("");
        setJoinRequestSocialInput("");
        setShowAdminRequestDetailPanel(false);
        setSelectedAdminRequest(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserState, supabase]);

  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }

    const channel = supabase
      .channel(`lug-join-requests-own-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lug_join_requests",
          filter: `requester_id=eq.${userId}`,
        },
        (payload: { eventType: string; new?: { status?: string } }) => {
          void loadMyJoinRequests(userId);
          const maybeStatus = String(payload.new?.status ?? "");
          if (payload.eventType === "UPDATE" && maybeStatus === "accepted") {
            void loadUserState(userId, userEmail ?? null);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMyJoinRequests, loadUserState, supabase, userEmail, userId]);

  useEffect(() => {
    if (!supabase || !userId || rolLug !== "admin" || !currentLugId) {
      return;
    }

    const channel = supabase
      .channel(`lug-join-requests-admin-${currentLugId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lug_join_requests",
          filter: `lug_id=eq.${currentLugId}`,
        },
        () => {
          void loadAdminPendingRequestsCount(currentLugId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentLugId, loadAdminPendingRequestsCount, rolLug, supabase, userId]);

  useEffect(() => {
    if (!userId || rolLug !== "admin" || !currentLugId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadAdminPendingRequestsCount(currentLugId);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [currentLugId, loadAdminPendingRequestsCount, rolLug, userId]);

  useEffect(() => {
    if (!showAdminRequestsPanel || !currentLugId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadAdminPendingRequestsList(currentLugId);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [currentLugId, loadAdminPendingRequestsList, showAdminRequestsPanel]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    if (!supabase) {
      setStatus(t.missingEnv);
      setLoading(false);
      return;
    }

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({ email, password });
      setStatus(error ? `${t.errorPrefix}: ${error.message}` : t.accountCreated);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setStatus(error ? `${t.errorPrefix}: ${error.message}` : "");
    }

    setLoading(false);
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  }

  async function openUserSettings() {
    if (!supabase || !userId) {
      return;
    }

    await ensureProfile(userId, userEmail);

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, social_platform, social_handle, avatar_key, preferred_language, current_lug_id, rol_lug")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    const fallbackName = String(userEmail ?? "Usuario").split("@")[0] || "Usuario";
    setSettingsNameInput(String(data?.full_name ?? fallbackName));
    setSettingsEmailInput(userEmail ?? "");
    setSettingsSocialPlatform(String(data?.social_platform ?? "instagram") === "facebook" ? "facebook" : "instagram");
    setSettingsSocialHandle(String(data?.social_handle ?? ""));
    setSettingsLanguageInput(String(data?.preferred_language ?? language) === "en" ? "en" : "es");
    setRolLug(String(data?.rol_lug ?? "") === "admin" ? "admin" : String(data?.rol_lug ?? "") === "common" ? "common" : null);

    const resolvedSettingsLugId = String(data?.current_lug_id ?? currentLugId ?? "").trim() || null;
    setSettingsLugId(resolvedSettingsLugId);

    const face = parseAvatarFace(data?.avatar_key);
    setSelectedFace(face);
    setPreviewFace(face);

    if (resolvedSettingsLugId) {
      const { data: lugData } = await supabase
        .from("lugs")
        .select("nombre")
        .eq("lug_id", resolvedSettingsLugId)
        .maybeSingle();

      setSettingsLugName(String(lugData?.nombre ?? "Sin LUG"));
    } else {
      setSettingsLugName("Sin LUG");
    }

    setShowPasswordFields(false);
    setSettingsPasswordInput("");
    setSettingsPasswordConfirmInput("");
    setShowFacePicker(false);
    setShowUserSettings(true);
  }

  async function saveUserSettings() {
    if (!supabase || !userId) {
      return;
    }

    setSettingsSaving(true);

    if (showPasswordFields) {
      if (settingsPasswordInput.length < 6) {
        setStatus("La nueva contrasena debe tener al menos 6 caracteres.");
        setSettingsSaving(false);
        return;
      }

      if (settingsPasswordInput !== settingsPasswordConfirmInput) {
        setStatus("Las contrasenas no coinciden.");
        setSettingsSaving(false);
        return;
      }
    }

    await ensureProfile(userId, userEmail);

    const avatarValue = `Cabeza_${String(selectedFace).padStart(2, "0")}.png`;
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: settingsNameInput.trim() || null,
        social_platform: settingsSocialPlatform || null,
        social_handle: settingsSocialHandle.trim() || null,
        avatar_key: avatarValue,
        preferred_language: settingsLanguageInput,
      })
      .eq("id", userId);

    if (profileError) {
      setStatus(`${t.errorPrefix}: ${profileError.message}`);
      setSettingsSaving(false);
      return;
    }

    if (settingsEmailInput && settingsEmailInput !== userEmail) {
      const { error: emailError } = await supabase.auth.updateUser({ email: settingsEmailInput });
      if (emailError) {
        setStatus(`${t.errorPrefix}: ${emailError.message}`);
        setSettingsSaving(false);
        return;
      }
      setUserEmail(settingsEmailInput);
    }

    if (showPasswordFields) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: settingsPasswordInput });
      if (passwordError) {
        setStatus(`${t.errorPrefix}: ${passwordError.message}`);
        setSettingsSaving(false);
        return;
      }
    }

    setDisplayName(settingsNameInput.trim() || displayName);
    setLanguage(settingsLanguageInput);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ui_language", settingsLanguageInput);
    }

    setShowUserSettings(false);
    setShowFacePicker(false);
    setShowPasswordFields(false);
    setSettingsPasswordInput("");
    setSettingsPasswordConfirmInput("");
    setSettingsSaving(false);
    setStatus("Configuracion guardada.");
  }

  async function handleMasterLogoFileChange(file: File | null) {
    setLugLogoError("");

    if (!file) {
      setLugLogoDataUrl(null);
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        if (img.width > 500 || img.height > 500) {
          setLugLogoError("La imagen debe ser maximo 500x500 px.");
          setLugLogoDataUrl(null);
        } else {
          setLugLogoDataUrl(dataUrl);
        }
        resolve();
      };
      img.onerror = () => {
        setLugLogoError("No pudimos leer la imagen.");
        setLugLogoDataUrl(null);
        resolve();
      };
      img.src = dataUrl;
    });
  }

  async function createLugFromMaster() {
    if (!supabase) {
      return;
    }

    if (!lugNombre.trim()) {
      setStatus("El nombre del LUG es obligatorio.");
      return;
    }

    setCreatingLug(true);

    const { error } = await supabase.from("lugs").insert({
      nombre: lugNombre.trim(),
      pais: lugPais.trim() || null,
      descripcion: lugDescripcion.trim() || null,
      color1: lugColor1.trim() || null,
      color2: lugColor2.trim() || null,
      color3: lugColor3.trim() || null,
      logo_data_url: lugLogoDataUrl,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setCreatingLug(false);
      return;
    }

    setLugNombre("");
    setLugPais("");
    setLugDescripcion("");
    setLugColor1("#006eb2");
    setLugColor2("#ffffff");
    setLugColor3("#111111");
    setLugLogoDataUrl(null);
    setLugLogoError("");
    setShowCreateLugPanel(false);
    await loadMasterLugs();
    setCreatingLug(false);
    setStatus("LUG creado correctamente.");
  }

  async function assignCurrentLug(lugId: string) {
    if (!supabase || !userId) {
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        current_lug_id: lugId,
      })
      .eq("id", userId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setCurrentLugId(lugId);
    setSettingsLugId(lugId);
    setStatus("LUG asignado al usuario.");
  }

  function openJoinRequestForm(lugId: string, lugName: string) {
    if (!userId) {
      return;
    }

    setJoinRequestTargetLugId(lugId);
    setJoinRequestTargetLugName(lugName);
    setJoinRequestMessageInput("");
    setJoinRequestSocialInput("");
    setShowJoinRequestFormPanel(true);
  }

  async function cancelLugJoinRequest(lugId: string, lugName: string) {
    if (!supabase || !userId) {
      return;
    }

    setRequestActionLoadingLugId(lugId);

    const { error } = await supabase
      .from("lug_join_requests")
      .update({ status: "cancelled" })
      .eq("requester_id", userId)
      .eq("lug_id", lugId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setRequestActionLoadingLugId(null);
      return;
    }

    setStatus(`Solicitud cancelada para ${lugName}.`);

    await loadMyJoinRequests(userId);
    if (rolLug === "admin" && currentLugId) {
      await loadAdminPendingRequestsCount(currentLugId);
    }

    setRequestActionLoadingLugId(null);
  }

  async function sendLugJoinRequest() {
    if (!supabase || !userId || !joinRequestTargetLugId) {
      return;
    }

    setJoinRequestSending(true);

    const { error } = await supabase.from("lug_join_requests").upsert(
      {
        requester_id: userId,
        lug_id: joinRequestTargetLugId,
        status: "pending",
        request_message: joinRequestMessageInput.trim() || null,
        contact_social: joinRequestSocialInput.trim() || null,
      },
      { onConflict: "requester_id,lug_id" },
    );

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setJoinRequestSending(false);
      return;
    }

    setStatus(`Solicitud de ingreso enviada para ${joinRequestTargetLugName}.`);
    await loadMyJoinRequests(userId);
    if (rolLug === "admin" && currentLugId) {
      await loadAdminPendingRequestsCount(currentLugId);
    }

    setJoinRequestSending(false);
    setShowJoinRequestFormPanel(false);
    setJoinRequestTargetLugId(null);
    setJoinRequestTargetLugName("");
    setJoinRequestMessageInput("");
    setJoinRequestSocialInput("");
  }

  async function openAdminRequestsPanel() {
    if (!currentLugId) {
      return;
    }

    setShowAdminRequestsPanel(true);
    await loadAdminPendingRequestsList(currentLugId);
  }

  function openAdminRequestDetail(request: AdminJoinRequestItem) {
    setSelectedAdminRequest(request);
    setShowAdminRequestDetailPanel(true);
  }

  async function resolveAdminRequest(decision: "accepted" | "rejected") {
    if (!supabase || !selectedAdminRequest) {
      return;
    }

    setAdminDecisionLoading(true);

    const { error } = await supabase.rpc("resolve_lug_join_request", {
      target_request_id: selectedAdminRequest.request_id,
      decision_value: decision,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setAdminDecisionLoading(false);
      return;
    }

    if (currentLugId) {
      await loadAdminPendingRequestsCount(currentLugId);
      await loadAdminPendingRequestsList(currentLugId);
      await loadMasterLugs();
    }

    setAdminDecisionLoading(false);
    setShowAdminRequestDetailPanel(false);
    setSelectedAdminRequest(null);
    setStatus(decision === "accepted" ? "Solicitud aceptada." : "Solicitud rechazada.");
  }

  async function openLugInfoPanel(lugId: string) {
    if (!supabase) {
      return;
    }

    setShowLugInfoPanel(true);
    setLugInfoLoading(true);

    const { data: lugData, error: lugError } = await supabase
      .from("lugs")
      .select("lug_id, nombre, pais, descripcion, color1, logo_data_url")
      .eq("lug_id", lugId)
      .maybeSingle();

    if (lugError || !lugData) {
      setStatus(`${t.errorPrefix}: ${lugError?.message ?? "No pudimos cargar el LUG."}`);
      setLugInfoData(null);
      setLugInfoLoading(false);
      return;
    }

    const { data: membersData, error: membersError } = await supabase.rpc("get_lug_members_current", {
      target_lug_id: lugId,
    });

    if (membersError) {
      setStatus(`${t.errorPrefix}: ${membersError.message}`);
    }

    const membersRows = (membersData ?? []) as Array<Record<string, unknown>>;
    const members = membersRows.map((member) => ({
      id: String(member.id),
      full_name: String(member.full_name ?? "Usuario"),
      social_platform: member.social_platform ? String(member.social_platform) : null,
      social_handle: member.social_handle ? String(member.social_handle) : null,
    }));

    setLugInfoData({
      lug_id: String(lugData.lug_id),
      nombre: String(lugData.nombre ?? ""),
      pais: lugData.pais ? String(lugData.pais) : null,
      descripcion: lugData.descripcion ? String(lugData.descripcion) : null,
      logo_data_url: lugData.logo_data_url ? String(lugData.logo_data_url) : null,
      color1: lugData.color1 ? String(lugData.color1) : null,
      members,
    });

    setLugInfoLoading(false);
  }

  async function handleSettingsLugLogoFileChange(file: File | null) {
    setSettingsLugLogoError("");

    if (!file) {
      setSettingsLugLogoDataUrl(null);
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        if (img.width > 500 || img.height > 500) {
          setSettingsLugLogoError("La imagen debe ser maximo 500x500 px.");
          setSettingsLugLogoDataUrl(null);
        } else {
          setSettingsLugLogoDataUrl(dataUrl);
        }
        resolve();
      };
      img.onerror = () => {
        setSettingsLugLogoError("No pudimos leer la imagen.");
        setSettingsLugLogoDataUrl(null);
        resolve();
      };
      img.src = dataUrl;
    });
  }

  async function openSettingsLugPanel() {
    if (!supabase || !settingsLugId) {
      setStatus("Este usuario no tiene LUG asignado.");
      return;
    }

    setSettingsLugPanelLoading(true);
    setShowSettingsLugPanel(true);
    setSettingsLugLogoError("");

    const { data, error } = await supabase
      .from("lugs")
      .select("lug_id, nombre, pais, descripcion, color1, color2, color3, logo_data_url")
      .eq("lug_id", settingsLugId)
      .maybeSingle();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setSettingsLugPanelLoading(false);
      return;
    }

    setSettingsLugNombreInput(String(data?.nombre ?? ""));
    setSettingsLugPaisInput(String(data?.pais ?? ""));
    setSettingsLugDescripcionInput(String(data?.descripcion ?? ""));
    setSettingsLugColor1Input(String(data?.color1 ?? "#006eb2"));
    setSettingsLugColor2Input(String(data?.color2 ?? "#ffffff"));
    setSettingsLugColor3Input(String(data?.color3 ?? "#111111"));
    setSettingsLugLogoDataUrl(data?.logo_data_url ? String(data.logo_data_url) : null);

    setSettingsLugPanelLoading(false);
  }

  async function saveSettingsLugPanel() {
    if (!supabase || !settingsLugId) {
      return;
    }

    if (rolLug !== "admin") {
      setStatus("Solo un admin del LUG puede editar esta informacion.");
      return;
    }

    setSettingsLugSaving(true);

    const { error } = await supabase
      .from("lugs")
      .update({
        nombre: settingsLugNombreInput.trim(),
        pais: settingsLugPaisInput.trim() || null,
        descripcion: settingsLugDescripcionInput.trim() || null,
        color1: settingsLugColor1Input.trim() || null,
        color2: settingsLugColor2Input.trim() || null,
        color3: settingsLugColor3Input.trim() || null,
        logo_data_url: settingsLugLogoDataUrl,
      })
      .eq("lug_id", settingsLugId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setSettingsLugSaving(false);
      return;
    }

    setSettingsLugName(settingsLugNombreInput.trim() || settingsLugName);
    await loadMasterLugs();
    setSettingsLugSaving(false);
    setShowSettingsLugPanel(false);
    setStatus("Informacion del LUG actualizada.");
  }

  const loadMasterLugs = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setMasterLugsLoading(true);

    const lugsResult = await supabase
      .from("lugs")
      .select("lug_id, nombre, pais, color1, logo_data_url")
      .order("created_at", { ascending: false });

    let lugsData = lugsResult.data;
    let lugsError = lugsResult.error;

    if (lugsError) {
      const fallbackLugs = await supabase
        .from("lugs")
        .select("lug_id, nombre, pais, color1")
        .order("created_at", { ascending: false });

      if (!fallbackLugs.error) {
        lugsData = (fallbackLugs.data ?? []).map((row) => ({
          ...row,
          logo_data_url: null,
        }));
        lugsError = null;
      }
    }

    if (lugsError) {
      setStatus(`${t.errorPrefix}: ${lugsError.message}`);
      setMasterLugs([]);
      setMasterLugsLoading(false);
      return;
    }

    const countsResult = await supabase.rpc("get_lug_member_counts_current");

    if (countsResult.error) {
      setStatus("No pudimos calcular la cantidad de miembros por LUG.");
    }

    const countRows = (countsResult.data ?? []) as Array<Record<string, unknown>>;
    const counts = countRows.reduce((acc: Record<string, number>, row) => {
      const key = String(row.lug_id ?? "").trim();
      if (!key) {
        return acc;
      }
      const value = Number(row.members_count ?? 0);
      acc[key] = Number.isFinite(value) ? value : 0;
      return acc;
    }, {});

    const parsed = (lugsData ?? []).map((lug) => ({
      lug_id: String(lug.lug_id),
      nombre: String(lug.nombre ?? ""),
      pais: lug.pais ? String(lug.pais) : null,
      color1: lug.color1 ? String(lug.color1) : null,
      logo_data_url: lug.logo_data_url ? String(lug.logo_data_url) : null,
      members_count: counts[String(lug.lug_id)] ?? 0,
    }));

    setMasterLugs(parsed);
    setMasterLugsLoading(false);
  }, [supabase, t.errorPrefix]);

  if (userEmail) {
    return (
      <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-[800px]">
          {isMaster ? (
            <button
              type="button"
              className="mb-3 w-full rounded-lg bg-black px-4 py-2 text-left text-sm font-semibold text-white"
              onClick={() => {
                setShowMasterPanel(true);
                void loadMasterLugs();
              }}
            >
              Master
            </button>
          ) : null}

          <div className="rounded-2xl border-[10px] border-[#006eb2] bg-white p-4 shadow-xl sm:p-8">
          <header className="border-b border-slate-200 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src={getFaceImagePath(selectedFace)}
                  alt="Avatar"
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 object-contain"
                />
                <div className="flex items-center gap-2">
                  <h1 className="break-all text-3xl font-semibold text-slate-900 sm:text-5xl">{displayName}</h1>
                  {rolLug === "admin" && adminPendingRequestsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => void openAdminRequestsPanel()}
                      className="relative rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700"
                      title="Solicitudes de ingreso"
                      aria-label="Solicitudes de ingreso"
                    >
                      <span className="text-base">✉</span>
                      <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
                        {adminPendingRequestsCount}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowLugsPanel(true);
                  void loadMasterLugs();
                  if (userId) {
                    void loadMyJoinRequests(userId);
                  }
                }}
                className="rounded-lg border border-slate-300 bg-white p-2"
                title="Ver LUGs"
              >
                <Image
                  src="/api/avatar/Mundo.png"
                  alt="Ver LUGs"
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 object-contain"
                />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-black">
              <p className="text-base font-medium">{userEmail}</p>
              <button
                type="button"
                aria-label={t.settingsAria}
                title={t.settingsTitle}
                onClick={() => void openUserSettings()}
                className="rounded-md border border-black/20 p-2"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 1-2 0 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 1 0-2 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6c.38 0 .75-.14 1-.4a1.7 1.7 0 0 1 2 0c.25.26.62.4 1 .4a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .38.14.75.4 1a1.7 1.7 0 0 1 0 2c-.26.25-.4.62-.4 1Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="rounded-md border border-black/20 px-3 py-1.5 text-sm"
              >
                {t.logout}
              </button>
            </div>
          </header>
          </div>

        {showUserSettings ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <h3 className="text-xl text-slate-900">Configuracion de usuario</h3>

              <div className="mt-4 flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewFace(selectedFace);
                    setShowFacePicker(true);
                  }}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 p-1"
                >
                  <Image
                    src={getFaceImagePath(selectedFace)}
                    alt={`Cara ${selectedFace}`}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <label className="block text-sm text-slate-700">Nombre</label>
                  <input
                    type="text"
                    value={settingsNameInput}
                    onChange={(event) => setSettingsNameInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <label className="mt-3 block text-sm text-slate-700">Mail</label>
              <input
                type="email"
                value={settingsEmailInput}
                onChange={(event) => setSettingsEmailInput(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />

              <button
                type="button"
                onClick={() => setShowPasswordFields((prev) => !prev)}
                className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {showPasswordFields ? "Ocultar cambio de contrasena" : "Cambiar contrasena"}
              </button>

              {showPasswordFields ? (
                <>
                  <label className="mt-3 block text-sm text-slate-700">Nueva contrasena</label>
                  <input
                    type="password"
                    value={settingsPasswordInput}
                    onChange={(event) => setSettingsPasswordInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <label className="mt-3 block text-sm text-slate-700">Repetir contrasena</label>
                  <input
                    type="password"
                    value={settingsPasswordConfirmInput}
                    onChange={(event) => setSettingsPasswordConfirmInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </>
              ) : null}

              <label className="mt-3 block text-sm text-slate-700">LUG</label>
              <button
                type="button"
                onClick={() => void openSettingsLugPanel()}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left"
              >
                {settingsLugName}
                {rolLug === "admin" ? " (admin)" : ""}
              </button>

              <label className="mt-3 block text-sm text-slate-700">Red social</label>
              <div className="mt-1 grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                <select
                  value={settingsSocialPlatform}
                  onChange={(event) => setSettingsSocialPlatform(event.target.value as SocialPlatform)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="">Ninguna</option>
                </select>
                <input
                  type="text"
                  value={settingsSocialHandle}
                  onChange={(event) => setSettingsSocialHandle(event.target.value)}
                  placeholder="usuario"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <label className="mt-3 block text-sm text-slate-700">Idioma</label>
              <select
                value={settingsLanguageInput}
                onChange={(event) => setSettingsLanguageInput(event.target.value as UiLanguage)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {uiLanguages.map((option) => (
                  <option key={option} value={option}>
                    {uiLanguageLabels[option]}
                  </option>
                ))}
              </select>

              {showFacePicker ? (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
                  onClick={() => setShowFacePicker(false)}
                >
                  <div className="w-full max-w-sm rounded-xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
                    <p className="text-sm text-slate-700">Doble clic para seleccionar</p>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {Array.from({ length: FACE_TOTAL }, (_, index) => {
                        const faceNum = index + 1;
                        const isPreview = previewFace === faceNum;
                        return (
                          <button
                            key={faceNum}
                            type="button"
                            onClick={() => setPreviewFace(faceNum)}
                            onDoubleClick={() => {
                              setSelectedFace(faceNum);
                              setPreviewFace(faceNum);
                              setShowFacePicker(false);
                            }}
                            className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border p-0.5 ${isPreview ? "border-[#006eb2] bg-[#cfeeff]" : "border-slate-200 bg-slate-50"}`}
                          >
                            <Image
                              src={getFaceImagePath(faceNum)}
                              alt={`Cara ${faceNum}`}
                              width={52}
                              height={52}
                              unoptimized
                              className="h-full w-full object-contain"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowFacePicker(false);
                    setShowPasswordFields(false);
                    setSettingsPasswordInput("");
                    setSettingsPasswordConfirmInput("");
                    setShowUserSettings(false);
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void saveUserSettings()}
                  disabled={settingsSaving}
                  className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                >
                  {settingsSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showSettingsLugPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowSettingsLugPanel(false)}>
            <div
              className={`w-full rounded-xl bg-white p-5 shadow-xl ${rolLug === "admin" ? "max-w-[500px]" : "max-w-[300px]"}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">
                  {rolLug === "admin" ? "Propiedades del LUG" : "Informacion del LUG"}
                </h3>
                {rolLug === "admin" ? (
                  <button
                    type="button"
                    onClick={() => setShowSettingsLugPanel(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                  >
                    Cerrar
                  </button>
                ) : null}
              </div>

              {settingsLugPanelLoading ? (
                <p className="mt-4 text-sm text-slate-600">Cargando informacion del LUG...</p>
              ) : (
                <>
                  {rolLug !== "admin" ? (
                    <div className="mx-auto mt-4 w-full max-w-[250px] rounded-lg border border-slate-300 bg-slate-50 p-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-5">
                        <div className="mx-auto h-40 w-40 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          {settingsLugLogoDataUrl ? (
                            <Image
                              src={settingsLugLogoDataUrl}
                              alt={settingsLugNombreInput || settingsLugName}
                              width={160}
                              height={160}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>

                        <div className="mt-4 text-center">
                          <p className="text-xl font-semibold text-slate-900">{settingsLugNombreInput || "Sin LUG"}</p>
                          <p className="mt-1 text-sm text-slate-600">{settingsLugPaisInput || "Sin pais"}</p>
                          <p className="mx-auto mt-4 max-w-[420px] text-sm leading-6 text-slate-700">{settingsLugDescripcionInput || "Sin descripcion"}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto mt-4 w-full max-w-[500px] space-y-3">
                      <div>
                        <label className="block text-sm text-slate-700">Logo</label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            void handleSettingsLugLogoFileChange(file);
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        {settingsLugLogoDataUrl ? (
                          <Image
                            src={settingsLugLogoDataUrl}
                            alt={settingsLugNombreInput || settingsLugName}
                            width={80}
                            height={80}
                            unoptimized
                            className="mt-2 h-20 w-20 rounded-md border border-slate-200 object-cover"
                          />
                        ) : null}
                        {settingsLugLogoError ? <p className="mt-1 text-xs text-red-600">{settingsLugLogoError}</p> : null}
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700">Nombre</label>
                        <input
                          type="text"
                          value={settingsLugNombreInput}
                          onChange={(event) => setSettingsLugNombreInput(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700">Pais / ciudad</label>
                        <input
                          type="text"
                          value={settingsLugPaisInput}
                          onChange={(event) => setSettingsLugPaisInput(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700">Descripcion</label>
                        <textarea
                          value={settingsLugDescripcionInput}
                          onChange={(event) => setSettingsLugDescripcionInput(event.target.value)}
                          rows={3}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center gap-2">
                          <input
                            type="color"
                            value={toColorPickerValue(settingsLugColor1Input, "#006eb2")}
                            onChange={(event) => setSettingsLugColor1Input(event.target.value)}
                            className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={settingsLugColor1Input}
                            onChange={(event) => setSettingsLugColor1Input(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <input
                            type="color"
                            value={toColorPickerValue(settingsLugColor2Input, "#ffffff")}
                            onChange={(event) => setSettingsLugColor2Input(event.target.value)}
                            className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={settingsLugColor2Input}
                            onChange={(event) => setSettingsLugColor2Input(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <input
                            type="color"
                            value={toColorPickerValue(settingsLugColor3Input, "#111111")}
                            onChange={(event) => setSettingsLugColor3Input(event.target.value)}
                            className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={settingsLugColor3Input}
                            onChange={(event) => setSettingsLugColor3Input(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`mt-4 flex gap-2 ${rolLug === "admin" ? "justify-end" : "justify-center"}`}>
                    {rolLug !== "admin" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsLugPanel(false);
                          setShowLugsPanel(true);
                          void loadMasterLugs();
                        }}
                        className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                      >
                        Cambiar de LUG
                      </button>
                    ) : null}
                    {rolLug === "admin" ? (
                      <button
                        type="button"
                        onClick={() => setShowSettingsLugPanel(false)}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                      >
                        Cerrar
                      </button>
                    ) : null}
                    {rolLug === "admin" ? (
                      <button
                        type="button"
                        onClick={() => void saveSettingsLugPanel()}
                        disabled={settingsLugSaving}
                        className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                      >
                        {settingsLugSaving ? "Guardando..." : "Guardar"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {showMasterPanel ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowMasterPanel(false)}>
            <div className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">Panel Master</h3>
                <button
                  type="button"
                  onClick={() => setShowMasterPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">LUGs</h4>
                  <button
                    type="button"
                    onClick={() => setShowCreateLugPanel(true)}
                    className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Crear LUG
                  </button>
                </div>

                <div className="mt-3 max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                  <p className="mb-2 text-xs text-slate-500">Doble clic en un LUG para asignarlo como actual.</p>
                  {masterLugsLoading ? (
                    <p className="text-sm text-slate-600">Cargando LUGs...</p>
                  ) : masterLugs.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay LUGs cargados.</p>
                  ) : (
                    <ul className="space-y-2">
                      {masterLugs.map((lug) => (
                        <li
                          key={lug.lug_id}
                          onDoubleClick={() => void assignCurrentLug(lug.lug_id)}
                          className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 ${
                            currentLugId === lug.lug_id ? "border-[#006eb2] bg-[#eaf6ff]" : "border-slate-200"
                          }`}
                        >
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                            {lug.logo_data_url ? (
                              <Image
                                src={lug.logo_data_url}
                                alt={lug.nombre}
                                width={44}
                                height={44}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{lug.nombre}</p>
                            <p className="truncate text-xs text-slate-600">{lug.pais ?? "Sin pais"}</p>
                          </div>
                          <p className="text-xs text-slate-700">{lug.members_count} miembros</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showLugsPanel ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowLugsPanel(false)}>
            <div className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">Lista de LUGs</h3>
              </div>

              <div className="mt-3 rounded-md border border-slate-200 p-2">
                <p className="mb-2 text-xs text-slate-500">Doble clic en un LUG para ver su informacion.</p>
                {masterLugsLoading ? (
                  <p className="text-sm text-slate-600">Cargando LUGs...</p>
                ) : masterLugs.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay LUGs cargados.</p>
                ) : (
                  <>
                    {currentUserLug ? (
                      <div className="mb-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tu LUG</p>
                        <div
                          onDoubleClick={() => void openLugInfoPanel(currentUserLug.lug_id)}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-300 p-2"
                          style={{
                            backgroundColor: currentUserLug.color1 || "#eaf6ff",
                            color: getContrastTextColor(currentUserLug.color1 || "#eaf6ff"),
                          }}
                        >
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                            {currentUserLug.logo_data_url ? (
                              <Image
                                src={currentUserLug.logo_data_url}
                                alt={currentUserLug.nombre}
                                width={44}
                                height={44}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{currentUserLug.nombre}</p>
                            <p className="truncate text-xs opacity-90">{`${currentUserLug.pais ?? "Sin pais"} - ${currentUserLug.members_count} miembros`}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                      {otherLugs.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay otros LUGs para mostrar.</p>
                      ) : (
                        <ul className="space-y-2">
                          {otherLugs.map((lug) => (
                            <li
                              key={lug.lug_id}
                              onDoubleClick={() => void openLugInfoPanel(lug.lug_id)}
                              className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-2"
                            >
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                                {lug.logo_data_url ? (
                                  <Image
                                    src={lug.logo_data_url}
                                    alt={lug.nombre}
                                    width={44}
                                    height={44}
                                    unoptimized
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">{lug.nombre}</p>
                                <p className="truncate text-xs text-slate-600">{`${lug.pais ?? "Sin pais"} - ${lug.members_count} miembros`}</p>
                              </div>
                              {rolLug !== "admin" ? (
                                <button
                                  type="button"
                                  disabled={requestActionLoadingLugId === lug.lug_id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (requestedLugIds.includes(lug.lug_id)) {
                                      void cancelLugJoinRequest(lug.lug_id, lug.nombre);
                                    } else {
                                      openJoinRequestForm(lug.lug_id, lug.nombre);
                                    }
                                  }}
                                  className="ml-auto rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                                >
                                  {requestActionLoadingLugId === lug.lug_id
                                    ? "Procesando..."
                                    : requestedLugIds.includes(lug.lug_id)
                                      ? "Cancelar solicitud"
                                      : "Solicitar ingreso"}
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {showJoinRequestFormPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowJoinRequestFormPanel(false)}>
            <div className="w-full max-w-[320px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-base font-semibold text-slate-900">Solicitar ingreso</h3>
              <p className="mt-1 text-xs text-slate-600">{joinRequestTargetLugName}</p>

              <div className="mt-3 space-y-2">
                <textarea
                  value={joinRequestMessageInput}
                  onChange={(event) => setJoinRequestMessageInput(event.target.value)}
                  rows={3}
                  placeholder="Escribe un mensaje"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={joinRequestSocialInput}
                  onChange={(event) => setJoinRequestSocialInput(event.target.value)}
                  placeholder="Red social"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void sendLugJoinRequest()}
                  disabled={joinRequestSending}
                  className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                >
                  {joinRequestSending ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showLugInfoPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowLugInfoPanel(false)}>
            <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">Informacion del LUG</h3>
              </div>

              {lugInfoLoading ? (
                <p className="mt-4 text-sm text-slate-600">Cargando informacion...</p>
              ) : lugInfoData ? (
                <>
                  <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                      <div className="mx-auto h-40 w-40 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {lugInfoData.logo_data_url ? (
                          <Image
                            src={lugInfoData.logo_data_url}
                            alt={lugInfoData.nombre}
                            width={160}
                            height={160}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="mt-4 text-center">
                        <p className="text-xl font-semibold text-slate-900">{lugInfoData.nombre || "Sin nombre"}</p>
                        <p className="mt-1 text-sm text-slate-600">{lugInfoData.pais || "Sin pais"}</p>
                        <p className="mx-auto mt-4 max-w-[320px] text-sm leading-6 text-slate-700">{lugInfoData.descripcion || "Sin descripcion"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 p-3">
                    <h4 className="text-sm font-semibold text-slate-900">Miembros</h4>
                    <div className="mt-2 max-h-[180px] overflow-auto rounded-md border border-slate-200 p-2">
                      {lugInfoData.members.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay miembros cargados.</p>
                      ) : (
                        <ul className="space-y-2">
                          {lugInfoData.members.map((member) => (
                            <li key={member.id} className="rounded-md border border-slate-200 px-3 py-2">
                              <p className="text-sm font-semibold text-slate-900">{member.full_name}</p>
                              <p className="text-xs text-slate-600">
                                {member.social_platform && member.social_handle
                                  ? `${member.social_platform}: ${member.social_handle}`
                                  : "Sin red social"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-600">No pudimos cargar el detalle del LUG.</p>
              )}
            </div>
          </div>
        ) : null}

        {showAdminRequestsPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowAdminRequestsPanel(false)}>
            <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">Solicitudes de ingreso</h3>
                <button
                  type="button"
                  onClick={() => setShowAdminRequestsPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-3 max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                {adminRequestsLoading ? (
                  <p className="text-sm text-slate-600">Cargando solicitudes...</p>
                ) : adminRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay solicitudes pendientes.</p>
                ) : (
                  <ul className="space-y-2">
                    {adminRequests.map((request) => (
                      <li
                        key={request.request_id}
                        onClick={() => openAdminRequestDetail(request)}
                        className="cursor-pointer rounded-md border border-slate-200 p-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">{request.full_name}</p>
                        <p className="text-xs text-slate-600">
                          {request.contact_social
                            ? request.contact_social
                            : request.social_platform && request.social_handle
                              ? `${request.social_platform}: ${request.social_handle}`
                              : "Sin red social"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {showAdminRequestDetailPanel && selectedAdminRequest ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setShowAdminRequestDetailPanel(false)}>
            <div className="w-full max-w-[360px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-base font-semibold text-slate-900">Solicitud de ingreso</h3>
              <p className="mt-2 text-sm font-semibold text-slate-900">{selectedAdminRequest.full_name}</p>
              <p className="mt-1 text-xs text-slate-600">
                {selectedAdminRequest.contact_social
                  ? selectedAdminRequest.contact_social
                  : selectedAdminRequest.social_platform && selectedAdminRequest.social_handle
                    ? `${selectedAdminRequest.social_platform}: ${selectedAdminRequest.social_handle}`
                    : "Sin red social"}
              </p>
              <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {selectedAdminRequest.request_message || "Sin mensaje"}
              </p>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void resolveAdminRequest("rejected")}
                  disabled={adminDecisionLoading}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => void resolveAdminRequest("accepted")}
                  disabled={adminDecisionLoading}
                  className="rounded-md bg-[#006eb2] px-3 py-2 text-sm font-semibold text-white"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showCreateLugPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowCreateLugPanel(false)}>
            <div className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-xl text-slate-900">Crear LUG</h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm text-slate-700">Cargar imagen logo (max 500x500)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleMasterLogoFileChange(file);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  {lugLogoDataUrl ? (
                    <Image src={lugLogoDataUrl} alt="Logo" width={80} height={80} unoptimized className="mt-2 h-20 w-20 rounded-md border border-slate-200 object-cover" />
                  ) : null}
                  {lugLogoError ? <p className="mt-1 text-xs text-red-600">{lugLogoError}</p> : null}
                </div>

                <div>
                  <label className="block text-sm text-slate-700">Nombre</label>
                  <input
                    type="text"
                    value={lugNombre}
                    onChange={(event) => setLugNombre(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700">Pais / ciudad</label>
                  <input
                    type="text"
                    value={lugPais}
                    onChange={(event) => setLugPais(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700">Descripcion</label>
                  <textarea
                    value={lugDescripcion}
                    onChange={(event) => setLugDescripcion(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm text-slate-700">Color1</label>
                    <input
                      type="text"
                      value={lugColor1}
                      onChange={(event) => setLugColor1(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700">Color2</label>
                    <input
                      type="text"
                      value={lugColor2}
                      onChange={(event) => setLugColor2(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700">Color3</label>
                    <input
                      type="text"
                      value={lugColor3}
                      onChange={(event) => setLugColor3(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateLugPanel(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void createLugFromMaster()}
                  disabled={creatingLug}
                  className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                >
                  {creatingLug ? "Creando..." : "Crear LUG"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {status ? <p className="mx-auto mt-4 w-full max-w-[800px] rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{status}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="bg-lego-tile min-h-screen px-6 py-16">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-black/10 bg-white p-7 text-black shadow-sm">
        <div className="flex items-center justify-between gap-3 text-black">
          <h1 className="text-2xl font-semibold text-black">{t.appAccessTitle}</h1>
          <label className="flex items-center gap-2 text-sm text-black">
            <span>{t.language}</span>
            <select
              value={language}
              onChange={(event) => {
                const next = event.target.value as UiLanguage;
                setLanguage(next);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("ui_language", next);
                }
              }}
              className="rounded-md border border-black/20 px-2 py-1 text-black"
            >
              {uiLanguages.map((option) => (
                <option key={option} value={option}>
                  {uiLanguageLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!supabase ? <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.missingEnv}</p> : null}

        <div className="mt-6 flex gap-2 rounded-lg bg-black/5 p-1">
          <button
            className={`w-1/2 rounded-md px-3 py-2 text-sm ${mode === "register" ? "bg-white shadow text-black" : "text-black"}`}
            onClick={() => setMode("register")}
            type="button"
          >
            {t.register}
          </button>
          <button
            className={`w-1/2 rounded-md px-3 py-2 text-sm ${mode === "login" ? "bg-white shadow text-black" : "text-black"}`}
            onClick={() => setMode("login")}
            type="button"
          >
            {t.login}
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-black" htmlFor="email">
              {t.email}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black" htmlFor="password">
              {t.password}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-black"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !supabase}
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? t.processing : submitText}
          </button>
        </form>

        {status ? <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{status}</p> : null}
      </section>
    </main>
  );
}
